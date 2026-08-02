'use strict';

class ProcessWaitlistJob {
  constructor({ waitlistService, logger = console }) {
    this.waitlistService = waitlistService;
    this.logger = logger;
  }
  async run({ availableSeats = [], actor = { role: 'SYSTEM' } } = {}) {
    const results = [];
    for (const seat of availableSeats) {
      try {
        const offer = await this.waitlistService.processAvailableSeat({ ...seat, actor });
        if (offer) results.push(offer);
      } catch (error) {
        this.logger.error?.(
          { journeySeatId: seat.journeySeatId, code: error.code, err: error },
          'Failed to process available seat for waitlist'
        );
      }
    }
    return { seatsProcessed: availableSeats.length, offersCreated: results.length, results };
  }
}

module.exports = ProcessWaitlistJob;
