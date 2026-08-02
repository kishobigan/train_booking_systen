'use strict';

const WAITLIST_STATUS = require('../../common/constants/waitlist-status.constants');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const WaitlistDuplicateError = require('../../common/errors/WaitlistDuplicateError');
const WaitlistError = require('../../common/errors/WaitlistError');
const WaitlistOfferExpiredError = require('../../common/errors/WaitlistOfferExpiredError');
const { postgresCode } = require('../../common/utils/database-error');

class WaitlistService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
    this.clock = dependencies.clock || (() => new Date());
  }

  async joinWaitlist(input) {
    this.#validateJoin(input);
    if (!this.config.enabled) throw new WaitlistError('Waitlist is disabled');
    const resolved = await this.seatAvailabilityService.resolveSegmentSequences(input);
    this.bookingService.validateJourneyForBooking(resolved.journey);
    this.bookingService.validateBookingWindow(resolved.journey);
    const coaches = await this.journeyCoachRepository.findAvailableByJourney(input.journeyId);
    if (!coaches.some((coach) => coach.coachClassSnapshot === input.requestedCoachClass))
      throw new WaitlistError('Requested coach class is unavailable on this journey');
    const available = await this.seatAvailabilityService.getAvailableSeatCount({
      ...input,
      ...resolved.segment,
      coachClass: input.requestedCoachClass,
    });
    if (available >= input.passengerCount)
      throw new WaitlistError('Seats are currently available; continue with normal booking', {
        code: 'SEATS_CURRENTLY_AVAILABLE',
        availableSeatCount: available,
      });
    const duplicateInput = { ...input, ...resolved.segment };
    if (await this.waitlistRepository.findDuplicateActiveEntry(duplicateInput))
      throw new WaitlistDuplicateError();
    try {
      return await this.transactionManager.executeSerializable(async (transaction) => {
        if (await this.waitlistRepository.findDuplicateActiveEntry(duplicateInput, { transaction }))
          throw new WaitlistDuplicateError();
        const entry = await this.waitlistRepository.create(
          {
            journeyId: input.journeyId,
            userId: input.userId,
            originJourneyStationId: input.originJourneyStationId,
            destinationJourneyStationId: input.destinationJourneyStationId,
            ...resolved.segment,
            requestedCoachClass: input.requestedCoachClass,
            passengerCount: input.passengerCount,
            status: WAITLIST_STATUS.WAITING,
            contactName: input.contact.fullName,
            contactEmail: input.contact.email || null,
            contactPhone: input.contact.phone || null,
          },
          { transaction }
        );
        await this.#audit(entry, 'WAITLIST_JOINED', input.userId, transaction);
        transaction.afterCommit?.(() =>
          this.notificationService?.waitlistStatusChanged({ entry, event: 'JOINED' })
        );
        return this.#entryResult(entry);
      });
    } catch (error) {
      if (postgresCode(error) === '23505') throw new WaitlistDuplicateError();
      throw error;
    }
  }

  async leaveWaitlist(input) {
    return this.cancelEntry(input);
  }

  async cancelEntry(input) {
    return this.transactionManager.executeSerializable(async (transaction) => {
      const entry = await this.#locked(input.waitlistEntryId, transaction);
      this.#assertOwner(entry, input.userId);
      if (entry.status === WAITLIST_STATUS.CANCELLED) return this.#entryResult(entry);
      if (![WAITLIST_STATUS.WAITING, WAITLIST_STATUS.OFFERED].includes(entry.status))
        throw new WaitlistError('This waitlist entry can no longer be cancelled');
      if (entry.status === WAITLIST_STATUS.OFFERED)
        await this.waitlistOfferService.releaseOffer(entry, transaction);
      await entry.update(
        {
          status: WAITLIST_STATUS.CANCELLED,
          offeredSeatId: null,
          offerExpiresAt: null,
        },
        { transaction }
      );
      await this.#audit(entry, 'WAITLIST_CANCELLED', input.userId, transaction, input.reason);
      transaction.afterCommit?.(() =>
        this.notificationService?.waitlistStatusChanged({ entry, event: 'CANCELLED' })
      );
      return this.#entryResult(entry);
    });
  }

  async getWaitlistEntry({ waitlistEntryId, userId, actor, ...options }) {
    const entry = await this.waitlistRepository.findDetails(waitlistEntryId, options);
    if (!entry) throw new NotFoundError('Waitlist entry not found');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor?.role)) this.#assertOwner(entry, userId);
    return entry;
  }

  getUserWaitlist(userId, options = {}) {
    return this.waitlistRepository.findByUserId(userId, options);
  }

  async getJourneyWaitlist(journeyId, actor, options = {}) {
    await this.accessControlService?.assertAdminJourneyAccess({ actor, journeyId });
    return this.waitlistRepository.findByJourneyId(journeyId, options);
  }

  findMatchingWaitlistEntries(input) {
    return this.waitlistRepository.findWaitingCandidates(input, {
      transaction: input.transaction,
    });
  }

  async processAvailableSeat(input) {
    const candidates = await this.findMatchingWaitlistEntries({
      ...input,
      availableSeatCount: input.journeySeatIds?.length || 1,
      availableSegments: [
        {
          originSequence: input.originSequence,
          destinationSequence: input.destinationSequence,
        },
      ],
      limit: 1,
    });
    if (!candidates.length) return null;
    return this.offerSeat({
      waitlistEntryId: candidates[0].id,
      journeySeatIds: input.journeySeatIds || [input.journeySeatId],
      actor: input.actor || { role: 'SYSTEM' },
    });
  }

  async offerSeat(input) {
    const entry = await this.waitlistRepository.findById(input.waitlistEntryId);
    if (!entry) throw new NotFoundError('Waitlist entry not found');
    const journey = await this.journeyService.getJourney(entry.journeyId);
    this.bookingService.validateJourneyForBooking(journey);
    this.bookingService.validateBookingWindow(journey);
    if (input.actor?.role !== 'SYSTEM')
      await this.accessControlService?.assertAdminJourneyAccess({
        actor: input.actor,
        journeyId: entry.journeyId,
      });
    return this.waitlistOfferService.offerSeat(input);
  }

  acceptOffer(input) {
    return this.transactionManager.executeSerializable(async (transaction) => {
      const idempotency = await this.idempotencyService?.begin({
        scope: `waitlist-accept:${input.waitlistEntryId}`,
        key: input.idempotencyKey,
        request: { passengers: input.passengers, contact: input.contact, userId: input.userId },
        transaction,
      });
      if (idempotency?.responseBody) return idempotency.responseBody;
      const entry = await this.#locked(input.waitlistEntryId, transaction);
      this.#assertOwner(entry, input.userId);
      if (entry.status !== WAITLIST_STATUS.OFFERED)
        throw new WaitlistError('No active seat offer exists');
      if (!entry.offerExpiresAt || entry.offerExpiresAt <= this.clock())
        throw new WaitlistOfferExpiredError();
      if (input.passengers?.length !== entry.passengerCount)
        throw new ValidationError('Passenger count must match the waitlist request');
      const allocations = await this.allocationRepository.findByWaitlistEntry(entry.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (allocations.length !== entry.passengerCount)
        throw new WaitlistError('The complete waitlist seat offer is no longer available');
      await this.allocationRepository.acquireSeatLocks({
        journeyId: entry.journeyId,
        seatIds: allocations.map((allocation) => allocation.seatId),
        transaction,
      });
      await this.waitlistOfferService.releaseOffer(entry, transaction);
      const booking = await this.convertToBooking({
        waitlistEntry: entry,
        passengers: input.passengers,
        contact: input.contact,
        userId: input.userId,
        journeySeatIds: allocations.map((allocation) => allocation.journeySeatId),
        transaction,
      });
      await entry.update(
        {
          status: WAITLIST_STATUS.CONVERTED,
          convertedBookingId: booking.bookingId,
          offeredSeatId: null,
          offerExpiresAt: null,
        },
        { transaction }
      );
      await this.#audit(entry, 'WAITLIST_CONVERTED', input.userId, transaction);
      transaction.afterCommit?.(() =>
        this.notificationService?.waitlistStatusChanged({ entry, event: 'CONVERTED' })
      );
      const result = { waitlistEntryId: entry.id, ...booking };
      await this.idempotencyService?.complete(
        idempotency,
        {
          resourceType: 'Booking',
          resourceId: booking.bookingId,
          responseStatus: 201,
          responseBody: result,
        },
        transaction
      );
      return result;
    });
  }

  convertToBooking(input) {
    return this.bookingService.createBookingHold({
      userId: input.userId,
      journeyId: input.waitlistEntry.journeyId,
      originJourneyStationId: input.waitlistEntry.originJourneyStationId,
      destinationJourneyStationId: input.waitlistEntry.destinationJourneyStationId,
      passengers: input.passengers.map((passenger, index) => ({
        ...passenger,
        journeySeatId: input.journeySeatIds[index],
      })),
      contact: input.contact,
      transaction: input.transaction,
    });
  }

  expireOffer(input) {
    return this.transactionManager.executeSerializable(async (transaction) => {
      const entry = await this.#locked(input.waitlistEntryId, transaction);
      if (entry.status !== WAITLIST_STATUS.OFFERED) return this.#entryResult(entry);
      if (entry.offerExpiresAt > this.clock() && input.actor?.role !== 'SYSTEM')
        throw new WaitlistError('The offer has not expired');
      await this.waitlistOfferService.releaseOffer(entry, transaction);
      if (this.config.requeueExpiredOffers)
        await this.requeueEntry({ waitlistEntry: entry, transaction });
      else
        await entry.update(
          { status: WAITLIST_STATUS.EXPIRED, offeredSeatId: null, offerExpiresAt: null },
          { transaction }
        );
      await this.#audit(
        entry,
        'WAITLIST_OFFER_EXPIRED',
        input.actor?.id,
        transaction,
        input.reason
      );
      transaction.afterCommit?.(() =>
        this.notificationService?.waitlistStatusChanged({ entry, event: entry.status })
      );
      return this.#entryResult(entry);
    });
  }

  requeueEntry({ waitlistEntry, transaction }) {
    return waitlistEntry.update(
      { status: WAITLIST_STATUS.WAITING, offeredSeatId: null, offerExpiresAt: null },
      { transaction }
    );
  }

  async getWaitlistPosition({ waitlistEntryId, userId }) {
    const entry = await this.waitlistRepository.findById(waitlistEntryId);
    if (!entry) throw new NotFoundError('Waitlist entry not found');
    this.#assertOwner(entry, userId);
    const entriesAhead =
      entry.status === WAITLIST_STATUS.WAITING
        ? await this.waitlistRepository.countCompatibleEntriesAhead(entry)
        : 0;
    return {
      waitlistEntryId: entry.id,
      status: entry.status,
      position: entry.status === WAITLIST_STATUS.WAITING ? entriesAhead + 1 : null,
      entriesAhead,
      journeyId: entry.journeyId,
      requestedCoachClass: entry.requestedCoachClass,
      segment: {
        originSequence: entry.originSequence,
        destinationSequence: entry.destinationSequence,
      },
    };
  }

  #validateJoin(input) {
    if (!input.userId || !input.journeyId)
      throw new ValidationError('User and journey are required');
    if (!input.originJourneyStationId || !input.destinationJourneyStationId)
      throw new ValidationError('Origin and destination are required');
    if (!input.requestedCoachClass) throw new ValidationError('requestedCoachClass is required');
    if (
      !Number.isInteger(input.passengerCount) ||
      input.passengerCount < 1 ||
      input.passengerCount > this.config.maxPassengersPerEntry
    )
      throw new ValidationError(
        `Passenger count must be between 1 and ${this.config.maxPassengersPerEntry}`
      );
    if (!input.contact?.fullName || (!input.contact.email && !input.contact.phone))
      throw new ValidationError('Contact name and email or phone are required');
  }

  async #locked(id, transaction) {
    const entry = await this.waitlistRepository.findByIdForUpdate(id, transaction);
    if (!entry) throw new NotFoundError('Waitlist entry not found');
    return entry;
  }

  #assertOwner(entry, userId) {
    if (entry.userId !== userId)
      throw new AuthorizationError('You cannot access this waitlist entry');
  }

  #entryResult(entry) {
    return {
      waitlistEntryId: entry.id,
      journeyId: entry.journeyId,
      status: entry.status,
      priorityNumber: entry.priorityNumber,
      requestedCoachClass: entry.requestedCoachClass,
      passengerCount: entry.passengerCount,
      offerExpiresAt: entry.offerExpiresAt,
      convertedBookingId: entry.convertedBookingId,
      segment: {
        originSequence: entry.originSequence,
        destinationSequence: entry.destinationSequence,
      },
    };
  }

  #audit(entry, action, userId, transaction, reason) {
    if (!this.auditService?.record) return null;
    return this.auditService.record(
      {
        userId: userId || null,
        action,
        entityType: 'WaitlistEntry',
        entityId: entry.id,
        newValues: { status: entry.status, reason: reason || null },
      },
      { transaction }
    );
  }
}

module.exports = WaitlistService;
