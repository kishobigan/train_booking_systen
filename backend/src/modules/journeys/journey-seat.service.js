'use strict';
const NotFoundError = require('../../common/errors/NotFoundError');
class JourneySeatService {
  constructor({ journeySeatRepository, transactionProvider, seatMapPublisher }) {
    Object.assign(this, { journeySeatRepository, transactionProvider, seatMapPublisher });
  }
  setStatus(journeySeatId, status, options = {}) {
    const operation = async (transaction) => {
      const seat = await this.journeySeatRepository.findById(journeySeatId, {
        transaction,
        lock: transaction?.LOCK?.UPDATE,
      });
      if (!seat) throw new NotFoundError('Journey seat not found');
      await seat.update({ status, blockedReason: options.reason || null }, { transaction });
      transaction?.afterCommit?.(() => this.#publish(seat, status));
      return seat;
    };
    if (options.transaction) return operation(options.transaction);
    return this.transactionProvider.transaction(operation);
  }
  blockSeat(id, reason, options) {
    return this.setStatus(id, 'BLOCKED', { ...options, reason });
  }
  markMaintenance(id, reason, options) {
    return this.setStatus(id, 'MAINTENANCE', { ...options, reason });
  }
  markAvailable(id, options) {
    return this.setStatus(id, 'AVAILABLE', options);
  }
  unblockSeat(id, options) {
    return this.markAvailable(id, options);
  }
  #publish(seat, status) {
    const payload = {
      journeyId: seat.journeyId,
      journeySeatId: seat.id,
      seatId: seat.seatId,
      status,
      selectable: status === 'AVAILABLE',
    };
    if (status === 'BLOCKED') return this.seatMapPublisher?.publishSeatBlocked(payload);
    if (status === 'MAINTENANCE') return this.seatMapPublisher?.publishSeatMaintenance(payload);
    return this.seatMapPublisher?.publishSeatUnblocked(payload);
  }
}
module.exports = JourneySeatService;
