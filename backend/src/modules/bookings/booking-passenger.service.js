'use strict';
const PASSENGER_TYPE = require('../../common/constants/passenger-type.constants');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const IDENTITY_TYPE = require('../../common/constants/passenger-identity-type.constants');
class BookingPassengerService {
  constructor({
    bookingPassengerRepository,
    journeySeatRepository,
    bookingRepository,
    bookingSeatRepository,
    allocationService,
    seatAvailabilityService,
    transactionManager,
    maximumPassengers = 6,
    passengerIdentityService,
    nicRequiredAge = 16,
  }) {
    this.repository = bookingPassengerRepository;
    this.journeySeatRepository = journeySeatRepository;
    this.bookingRepository = bookingRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.allocationService = allocationService;
    this.seatAvailabilityService = seatAvailabilityService;
    this.transactionManager = transactionManager;
    this.maximumPassengers = maximumPassengers;
    this.passengerIdentityService = passengerIdentityService;
    this.nicRequiredAge = nicRequiredAge;
  }
  /** Create one passenger using server-calculated fare values. */
  createPassenger({ bookingId, passenger, fareBreakdown, assignedSeatId, transaction }) {
    this.validatePassenger(passenger);
    return this.repository.create(
      this.#values(bookingId, passenger, fareBreakdown, assignedSeatId),
      { transaction }
    );
  }
  /** Bulk-create ordered passengers and match each server fare entry. */
  bulkCreatePassengers({
    bookingId,
    passengers,
    fareBreakdown,
    assignedSeatIds,
    transaction,
    requireIdentity = false,
  }) {
    this.validatePassengerList(passengers, { requireIdentity });
    if (fareBreakdown.passengers.length !== passengers.length)
      throw new ValidationError('Passenger and fare counts do not match');
    return this.repository
      .bulkCreate(
        passengers.map((passenger, index) =>
          this.#values(
            bookingId,
            passenger,
            fareBreakdown.passengers[index],
            assignedSeatIds[index]
          )
        ),
        { transaction, returning: true }
      )
      .then(async (created) => {
        const byNumber = new Map(
          created.map((passenger) => [passenger.passengerNumber, passenger])
        );
        await Promise.all(
          created.map((record, index) => {
            const guardianNumber = passengers[index].guardianPassengerNumber;
            if (!guardianNumber) return null;
            return record.update(
              { guardianPassengerId: byNumber.get(guardianNumber).id },
              { transaction }
            );
          })
        );
        return created;
      });
  }
  /** Get one booking passenger. */
  async getPassengerById(id, options = {}) {
    const item = await this.repository.findById(id, options);
    if (!item) throw new NotFoundError('Booking passenger not found');
    return item;
  }
  /** List passengers belonging to a booking. */
  getBookingPassengers(bookingId, options = {}) {
    return this.repository.findByBooking(bookingId, options);
  }
  /** Update whitelisted passenger identity fields. */
  async updatePassenger(id, values, options = {}) {
    const passenger = await this.getPassengerById(id, options);
    const allowed = Object.fromEntries(
      ['fullName', 'passengerType', 'identityType', 'identityNumber', 'dateOfBirth']
        .filter((field) => values[field] !== undefined)
        .map((field) => [field, values[field]])
    );
    this.validatePassenger({ ...passenger.get?.(), ...passenger, ...allowed });
    return passenger.update(allowed, options);
  }
  /** Delete a passenger record. */
  async deletePassenger(id, options = {}) {
    const passenger = await this.getPassengerById(id, options);
    await passenger.destroy(options);
    return true;
  }
  /** Assign a physical seat after caller-managed allocation replacement. */
  async assignSeat(input) {
    const operation = async (transaction) => {
      const booking = await this.bookingRepository.findByIdForUpdate(input.bookingId, transaction);
      if (!booking) throw new NotFoundError('Booking not found');
      if (!['HELD', 'CONFIRMED'].includes(booking.status))
        throw new ValidationError('Booking is not editable');
      const passenger = await this.repository.findByBookingAndId(
        input.bookingId,
        input.bookingPassengerId,
        { transaction, lock: transaction.LOCK?.UPDATE ?? true }
      );
      if (!passenger) throw new NotFoundError('Booking passenger not found');
      const journeySeat = await this.journeySeatRepository.findByIdWithCoach(input.journeySeatId, {
        transaction,
      });
      if (!journeySeat || journeySeat.journeyId !== booking.journeyId)
        throw new NotFoundError('Journey seat not found for booking journey');
      const duplicate = await this.repository.findByAssignedSeat(
        input.bookingId,
        journeySeat.seatId,
        { transaction }
      );
      if (duplicate && duplicate.id !== passenger.id)
        throw new ValidationError('Seat is already assigned in this booking');
      await this.allocationService.repository.acquireSeatLocks({
        journeyId: booking.journeyId,
        seatIds: [journeySeat.seatId],
        transaction,
      });
      await this.seatAvailabilityService.assertSeatAvailable({
        journeyId: booking.journeyId,
        journeySeatId: journeySeat.id,
        originSequence: booking.originSequence,
        destinationSequence: booking.destinationSequence,
        transaction,
      });
      const oldBookingSeat = await this.bookingSeatRepository.findByPassenger(
        input.bookingId,
        passenger.id,
        { transaction }
      );
      const newBookingSeat = await this.bookingSeatRepository.create(
        {
          bookingId: booking.id,
          bookingPassengerId: passenger.id,
          journeyId: booking.journeyId,
          journeySeatId: journeySeat.id,
          seatId: journeySeat.seatId,
          originSequence: booking.originSequence,
          destinationSequence: booking.destinationSequence,
          status: booking.status,
          holdExpiresAt: booking.status === 'HELD' ? booking.holdExpiresAt : null,
          seatNumberSnapshot: journeySeat.seatNumberSnapshot,
          coachNumberSnapshot: journeySeat.journeyCoach.coachNumberSnapshot,
          coachClassSnapshot: journeySeat.journeyCoach.coachClassSnapshot,
          fareAmount: passenger.finalFare,
        },
        { transaction }
      );
      await this.allocationService.createAllocation({
        bookingSeatId: newBookingSeat.id,
        journeyId: booking.journeyId,
        seatId: journeySeat.seatId,
        originSequence: booking.originSequence,
        destinationSequence: booking.destinationSequence,
        allocationType: booking.status,
        expiresAt: booking.status === 'HELD' ? booking.holdExpiresAt : null,
        transaction,
      });
      await passenger.update({ assignedSeatId: journeySeat.seatId }, { transaction });
      if (oldBookingSeat) {
        await this.allocationService.releaseAllocation({
          bookingSeatId: oldBookingSeat.id,
          transaction,
        });
        await oldBookingSeat.destroy({ transaction });
      }
      return passenger;
    };
    if (input.transaction) return operation(input.transaction);
    if (!this.transactionManager)
      throw new ValidationError('Seat assignment requires transaction services');
    return this.transactionManager.executeSerializable(operation);
  }
  /** Clear a passenger's assigned physical seat. */
  async removeSeat(input) {
    const operation = async (transaction) => {
      const booking = await this.bookingRepository.findByIdForUpdate(input.bookingId, transaction);
      if (!booking) throw new NotFoundError('Booking not found');
      if (booking.status !== 'HELD')
        throw new ValidationError('Seats can only be removed from held bookings');
      const passenger = await this.repository.findByBookingAndId(
        input.bookingId,
        input.bookingPassengerId,
        { transaction }
      );
      if (!passenger) throw new NotFoundError('Booking passenger not found');
      const bookingSeat = await this.bookingSeatRepository.findByPassenger(
        input.bookingId,
        passenger.id,
        { transaction }
      );
      if (bookingSeat) {
        await this.allocationService.releaseAllocation({
          bookingSeatId: bookingSeat.id,
          transaction,
        });
        await bookingSeat.destroy({ transaction });
      }
      return passenger.update({ assignedSeatId: null }, { transaction });
    };
    if (input.transaction) return operation(input.transaction);
    if (!this.transactionManager)
      throw new ValidationError('Seat removal requires transaction services');
    return this.transactionManager.executeSerializable(operation);
  }
  /** Validate one passenger. */
  validatePassenger(passenger) {
    if (!String(passenger?.fullName || '').trim())
      throw new ValidationError('Passenger fullName is required');
    if (!Object.values(PASSENGER_TYPE).includes(passenger.passengerType))
      throw new ValidationError('Unsupported passengerType');
    return passenger;
  }
  /** Validate a passenger list and selected-seat uniqueness. */
  validatePassengerList(passengers, { requireIdentity = false } = {}) {
    this.validatePassengerCount(passengers?.length);
    passengers.forEach((passenger) => this.validatePassenger(passenger));
    const ids = passengers.map((passenger) => passenger.journeySeatId).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      throw new ValidationError('Duplicate journey seats are not allowed');
    if (requireIdentity) this.#validateIdentities(passengers);
    return passengers;
  }
  /** Validate configured booking passenger count. */
  validatePassengerCount(count) {
    if (!Number.isInteger(count) || count < 1 || count > this.maximumPassengers)
      throw new ValidationError(`Passenger count must be between 1 and ${this.maximumPassengers}`);
    return count;
  }
  #values(bookingId, passenger, fare, assignedSeatId) {
    const identity =
      this.passengerIdentityService && passenger.identityType
        ? this.passengerIdentityService.prepare(passenger)
        : { identityNumber: passenger.identityNumber };
    return {
      bookingId,
      passengerNumber: passenger.passengerNumber,
      fullName: passenger.fullName.trim(),
      passengerType: passenger.passengerType,
      identityType: passenger.identityType,
      ...identity,
      identityCountry:
        passenger.identityCountry || (passenger.identityType === 'NIC' ? 'LKA' : null),
      guardianRelationship: passenger.guardianRelationship,
      dateOfBirth: passenger.dateOfBirth,
      assignedSeatId,
      fareBeforeDiscount: fare.fareBeforeDiscount,
      discountAmount: fare.discountAmount,
      finalFare: fare.fareAfterDiscount,
    };
  }
  #age(dateOfBirth) {
    const born = new Date(`${dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(born.getTime()) || born > new Date())
      throw new ValidationError('A valid dateOfBirth is required');
    const today = new Date();
    let age = today.getUTCFullYear() - born.getUTCFullYear();
    if (
      today.getUTCMonth() < born.getUTCMonth() ||
      (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())
    )
      age -= 1;
    return age;
  }
  #validateIdentities(passengers) {
    const numbers = passengers.map((passenger, index) => passenger.passengerNumber ?? index + 1);
    if (
      new Set(numbers).size !== passengers.length ||
      numbers.some((number, index) => number !== index + 1)
    )
      throw new ValidationError('passengerNumber must be consecutive starting at 1');
    const identities = new Set();
    passengers.forEach((passenger, index) => {
      passenger.passengerNumber = numbers[index];
      const age = this.#age(passenger.dateOfBirth);
      const prepared = this.passengerIdentityService.prepare(passenger);
      if (prepared.identityNumberHash) {
        if (identities.has(prepared.identityNumberHash))
          throw new ValidationError('Duplicate passenger identity');
        identities.add(prepared.identityNumberHash);
      }
      if (passenger.identityType === IDENTITY_TYPE.DEPENDENT) {
        const guardian = passengers[numbers.indexOf(Number(passenger.guardianPassengerNumber))];
        if (
          !guardian ||
          guardian === passenger ||
          guardian.identityType === IDENTITY_TYPE.DEPENDENT
        )
          throw new ValidationError(
            'A dependent requires an identified guardian in the same booking'
          );
        if (this.#age(guardian.dateOfBirth) < this.nicRequiredAge)
          throw new ValidationError('A guardian must be at least the configured adult age');
      } else if (age < this.nicRequiredAge && passenger.identityType === IDENTITY_TYPE.NIC) {
        throw new ValidationError(
          'Passengers below the configured age should use dependent identity'
        );
      }
    });
  }
}
module.exports = BookingPassengerService;
