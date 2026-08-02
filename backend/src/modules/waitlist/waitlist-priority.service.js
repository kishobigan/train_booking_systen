'use strict';

class WaitlistPriorityService {
  calculatePriority({ createdAt = new Date(), priorityNumber } = {}) {
    return { createdAt, priorityNumber: priorityNumber ?? null };
  }
  compareEntries(left, right) {
    const priority = Number(left.priorityNumber) - Number(right.priorityNumber);
    return priority || new Date(left.createdAt) - new Date(right.createdAt);
  }
  async getNextPriorityNumber(waitlistRepository, options = {}) {
    const maximum = await waitlistRepository.model.max('priorityNumber', options);
    return Number(maximum || 0) + 1;
  }
}

module.exports = WaitlistPriorityService;
