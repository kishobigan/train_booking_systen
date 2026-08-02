'use strict';
const BookingConflictError = require('../../common/errors/BookingConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const { createSegment } = require('../../common/utils/segment-overlap');
const { mapDatabaseError } = require('../../common/utils/database-error');

class AllocationService {
  constructor({ allocationRepository, bookingSeatRepository, seatAvailabilityService }) {
    this.repository = allocationRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.seatAvailabilityService = seatAvailabilityService;
  }
  /** Create one active allocation and map exclusion violations to a conflict. */
  async createAllocation(input) {
    await this.validateAllocation(input);
    try {
      return await this.repository.create(
        {
          bookingSeatId: input.bookingSeatId,
          journeySeatId: input.journeySeatId,
          journeyId: input.journeyId,
          seatId: input.seatId,
          occupiedSegment: [input.originSequence, input.destinationSequence],
          allocationType: input.allocationType,
          expiresAt: input.expiresAt ?? null,
        },
        { transaction: input.transaction }
      );
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
  /** Lock deterministically and create all allocations without partial success. */
  async createAllocations({ allocations, transaction }) {
    if (!transaction) throw new ValidationError('Allocation creation requires a transaction');
    const seatIds = allocations.map((item) => item.seatId);
    if (new Set(seatIds).size !== seatIds.length)
      throw new ValidationError('Duplicate physical seats are not allowed');
    const sorted = [...allocations].sort((a, b) => a.seatId.localeCompare(b.seatId));
    if (sorted.length) {
      await this.repository.acquireSeatLocks({
        journeyId: sorted[0].journeyId,
        seatIds: sorted.map((item) => item.seatId),
        transaction,
      });
    }
    const created = [];
    for (const allocation of sorted)
      created.push(await this.createAllocation({ ...allocation, transaction }));
    return created;
  }
  /** Idempotently release an allocation while preserving booking-seat history. */
  releaseAllocation({ bookingSeatId, transaction }) {
    return this.repository.model.destroy({ transaction, where: { bookingSeatId } });
  }
  /** Release every active allocation for a booking. */
  releaseBookingAllocations({ bookingId, transaction }) {
    return this.repository.deleteByBooking(bookingId, { transaction });
  }
  /** Confirm one held allocation and clear expiry. */
  async confirmAllocation({ bookingSeatId, transaction }) {
    const allocation = await this.repository.findByBookingSeat(bookingSeatId, {
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (!allocation) throw new NotFoundError('Active allocation not found');
    if (allocation.allocationType !== 'HELD')
      throw new BookingConflictError('Allocation is not held');
    if (allocation.expiresAt <= new Date())
      throw new BookingConflictError('Allocation hold has expired');
    await allocation.update({ allocationType: 'CONFIRMED', expiresAt: null }, { transaction });
    await this.bookingSeatRepository.updateById(
      bookingSeatId,
      { status: 'CONFIRMED', holdExpiresAt: null },
      { transaction }
    );
    return allocation;
  }
  /** Confirm every expected held allocation for a booking. */
  async confirmBookingAllocations({ bookingId, transaction }) {
    const seats = await this.bookingSeatRepository.findByBooking(bookingId, { transaction });
    const allocations = await Promise.all(
      seats.map((seat) =>
        this.repository.findByBookingSeat(seat.id, { transaction, lock: transaction?.LOCK?.UPDATE })
      )
    );
    if (allocations.some((allocation) => !allocation))
      throw new BookingConflictError('Booking allocation count is inconsistent');
    for (const allocation of allocations) {
      if (allocation.allocationType !== 'HELD' || allocation.expiresAt <= new Date())
        throw new BookingConflictError('A booking allocation is not confirmable');
      await allocation.update({ allocationType: 'CONFIRMED', expiresAt: null }, { transaction });
    }
    await this.bookingSeatRepository.updateStatusesByBooking(bookingId, 'CONFIRMED', {
      transaction,
    });
    return allocations;
  }
  /** Expire one allocation and retain the booking-seat row. */
  async expireAllocation({ bookingSeatId, transaction }) {
    await this.releaseAllocation({ bookingSeatId, transaction });
    await this.bookingSeatRepository.updateById(
      bookingSeatId,
      { status: 'EXPIRED' },
      { transaction }
    );
    return true;
  }
  /** Expire all booking allocations and update historical seat rows. */
  async expireBookingAllocations({ bookingId, transaction }) {
    await this.releaseBookingAllocations({ bookingId, transaction });
    await this.bookingSeatRepository.updateStatusesByBooking(bookingId, 'EXPIRED', { transaction });
    return true;
  }
  /** Find an overlapping active allocation. */
  findOverlappingAllocation(input) {
    return this.repository.findConflicts(
      input.journeyId,
      input.seatId,
      input.originSequence,
      input.destinationSequence,
      input.transaction ? { transaction: input.transaction } : {}
    );
  }
  /** Validate allocation type, expiry, segment, and booking-seat identity. */
  async validateAllocation(input) {
    createSegment(Number(input.originSequence), Number(input.destinationSequence));
    if (!['HELD', 'CONFIRMED'].includes(input.allocationType))
      throw new ValidationError('Allocation type must be HELD or CONFIRMED');
    if (input.allocationType === 'HELD' && !input.expiresAt)
      throw new ValidationError('HELD allocation requires expiresAt');
    if (input.allocationType === 'CONFIRMED' && input.expiresAt)
      throw new ValidationError('CONFIRMED allocation cannot have expiresAt');
    const bookingSeat = await this.bookingSeatRepository.findById(input.bookingSeatId, {
      transaction: input.transaction,
    });
    if (!bookingSeat) throw new NotFoundError('Booking seat not found');
    if (bookingSeat.journeyId !== input.journeyId || bookingSeat.seatId !== input.seatId)
      throw new ValidationError('Allocation does not match booking seat');
    return true;
  }
}
module.exports = AllocationService;
