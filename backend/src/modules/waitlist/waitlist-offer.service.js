'use strict';

const WAITLIST_STATUS = require('../../common/constants/waitlist-status.constants');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const WaitlistError = require('../../common/errors/WaitlistError');
const WaitlistOfferUnavailableError = require('../../common/errors/WaitlistOfferUnavailableError');
const { mapDatabaseError } = require('../../common/utils/database-error');

class WaitlistOfferService {
  constructor({
    waitlistRepository,
    allocationRepository,
    seatAvailabilityService,
    transactionManager,
    notificationService,
    auditService,
    config,
    clock = () => new Date(),
  }) {
    Object.assign(this, {
      waitlistRepository,
      allocationRepository,
      seatAvailabilityService,
      transactionManager,
      notificationService,
      auditService,
      config,
      clock,
    });
  }

  offerSeat(input) {
    const journeySeatIds = input.journeySeatIds || [input.journeySeatId].filter(Boolean);
    return this.transactionManager.executeSerializable(async (transaction) => {
      const entry = await this.waitlistRepository.findByIdForUpdate(
        input.waitlistEntryId,
        transaction
      );
      if (!entry) throw new NotFoundError('Waitlist entry not found');
      if (entry.status !== WAITLIST_STATUS.WAITING)
        throw new WaitlistError('Only waiting entries can receive an offer');
      if (journeySeatIds.length !== entry.passengerCount)
        throw new WaitlistError('The offer must hold one seat for every requested passenger');
      const preview = await this.seatAvailabilityService.checkMultipleSeatsAvailability({
        journeyId: entry.journeyId,
        journeySeatIds,
        originSequence: entry.originSequence,
        destinationSequence: entry.destinationSequence,
        transaction,
      });
      if (!preview.allAvailable) throw new WaitlistOfferUnavailableError();
      await this.allocationRepository.acquireSeatLocks({
        journeyId: entry.journeyId,
        seatIds: preview.seats.map((seat) => seat.seatId),
        transaction,
      });
      const revalidated = await this.seatAvailabilityService.revalidateSeatsForBooking({
        journeyId: entry.journeyId,
        journeySeatIds,
        originSequence: entry.originSequence,
        destinationSequence: entry.destinationSequence,
        transaction,
      });
      if (revalidated.seats.some((seat) => seat.coachClass !== entry.requestedCoachClass))
        throw new WaitlistOfferUnavailableError('Offered seats must use the requested coach class');
      const expiresAt = new Date(this.clock().getTime() + this.config.offerMinutes * 60_000);
      try {
        await this.allocationRepository.createWaitlistAllocations(
          revalidated.seats.map((seat) => ({
            waitlistEntryId: entry.id,
            journeySeatId: seat.journeySeatId,
            journeyId: entry.journeyId,
            seatId: seat.seatId,
            originSequence: entry.originSequence,
            destinationSequence: entry.destinationSequence,
            expiresAt,
          })),
          { transaction }
        );
      } catch (error) {
        const mapped = mapDatabaseError(error);
        throw new WaitlistOfferUnavailableError(mapped.message);
      }
      await entry.update(
        {
          status: WAITLIST_STATUS.OFFERED,
          offeredSeatId: revalidated.seats[0].seatId,
          offerExpiresAt: expiresAt,
          offerAttemptCount: Number(entry.offerAttemptCount || 0) + 1,
        },
        { transaction }
      );
      await this.#audit(entry, 'WAITLIST_SEATS_OFFERED', input.actor, transaction);
      transaction.afterCommit?.(() =>
        this.notificationService?.waitlistStatusChanged({ entry, event: 'OFFERED' })
      );
      return {
        waitlistEntryId: entry.id,
        status: entry.status,
        offeredSeats: revalidated.seats,
        offeredSeat: revalidated.seats[0],
        segment: {
          originSequence: entry.originSequence,
          destinationSequence: entry.destinationSequence,
        },
        offerExpiresAt: expiresAt,
        actionRequired: 'ACCEPT_AND_BOOK',
      };
    });
  }

  async releaseOffer(entry, transaction) {
    return this.allocationRepository.deleteByWaitlistEntry(entry.id, { transaction });
  }

  assertOwner(entry, userId) {
    if (entry.userId !== userId)
      throw new AuthorizationError('You cannot access this waitlist entry');
  }

  #audit(entry, action, actor, transaction) {
    if (!this.auditService?.record) return null;
    return this.auditService.record(
      {
        userId: actor?.id || entry.userId,
        action,
        entityType: 'WaitlistEntry',
        entityId: entry.id,
        newValues: { status: entry.status, journeyId: entry.journeyId },
      },
      { transaction }
    );
  }
}

module.exports = WaitlistOfferService;
