'use strict';
const NotFoundError = require('../../common/errors/NotFoundError');
class JourneyCoachService {
  constructor({ journeyCoachRepository, transactionProvider, seatMapPublisher }) {
    Object.assign(this, { journeyCoachRepository, transactionProvider, seatMapPublisher });
  }
  setAvailability(id, isAvailable, options = {}) {
    const operation = async (transaction) => {
      const coach = await this.journeyCoachRepository.findById(id, {
        transaction,
        lock: transaction?.LOCK?.UPDATE,
      });
      if (!coach) throw new NotFoundError('Journey coach not found');
      await coach.update({ isAvailable }, { transaction });
      transaction?.afterCommit?.(() =>
        this.seatMapPublisher?.publishCoachAvailabilityChanged({
          journeyId: coach.journeyId,
          journeyCoachId: coach.id,
          coachNumber: coach.coachNumberSnapshot,
          isAvailable,
        })
      );
      return coach;
    };
    return options.transaction
      ? operation(options.transaction)
      : this.transactionProvider.transaction(operation);
  }
}
module.exports = JourneyCoachService;
