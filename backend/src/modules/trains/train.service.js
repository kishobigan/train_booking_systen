'use strict';

const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const TrainRepository = require('./train.repository');
const { normalizeTrainInput } = require('./train.dto');

class TrainService {
  constructor(trainRepository = new TrainRepository()) {
    this.trainRepository = trainRepository;
  }

  async createTrain(input, options = {}) {
    const values = normalizeTrainInput(input);
    if (!values.trainNumber) throw new ValidationError('trainNumber is required');
    await this.#ensureNumberAvailable(values.trainNumber, null, options);
    return this.trainRepository.create(values, options);
  }

  async getTrain(id, options = {}) {
    const train = await this.trainRepository.findById(id, options);
    if (!train) throw new NotFoundError('Train not found', { id });
    return train;
  }

  async getTrainByNumber(trainNumber, options = {}) {
    const normalizedNumber = this.#normalizeNumber(trainNumber);
    const train = await this.trainRepository.findByNumber(normalizedNumber, options);
    if (!train) throw new NotFoundError('Train not found', { trainNumber: normalizedNumber });
    return train;
  }

  async getTrainConfiguration(id, options = {}) {
    const train = await this.trainRepository.findConfiguration(id, options);
    if (!train) throw new NotFoundError('Train not found', { id });
    return train;
  }

  listTrains(filters = {}, options = {}) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.trainRepository.paginate(where, {
      ...options,
      page: filters.page,
      pageSize: filters.pageSize,
      order: options.order || [['trainNumber', 'ASC']],
    });
  }

  async updateTrain(id, input, options = {}) {
    const train = await this.getTrain(id, options);
    const values = normalizeTrainInput(input);
    if (!Object.keys(values).length) {
      throw new ValidationError('At least one train field must be provided');
    }
    if (values.trainNumber !== undefined) {
      await this.#ensureNumberAvailable(values.trainNumber, id, options);
    }
    return train.update(values, options);
  }

  async deleteTrain(id, options = {}) {
    const train = await this.getTrain(id, options);
    await train.destroy(options);
    return true;
  }

  async calculateCapacity(id, { includeInactive = false, ...options } = {}) {
    const train = await this.getTrainConfiguration(id, options);
    const coaches = (train.coaches || []).filter((coach) => includeInactive || coach.isActive);
    const summary = {
      trainId: train.id,
      trainNumber: train.trainNumber,
      coachCount: coaches.length,
      totalCapacity: 0,
      declaredCapacity: 0,
      configuredSeatCount: 0,
      byClass: {},
      byReservationType: {},
      coaches: [],
    };

    for (const coach of coaches) {
      const seats = (coach.seats || []).filter((seat) => includeInactive || seat.isActive);
      const declaredCapacity = Number(coach.totalSeats) || 0;
      const configuredSeatCount = seats.length;
      summary.declaredCapacity += declaredCapacity;
      summary.configuredSeatCount += configuredSeatCount;
      summary.byClass[coach.coachClass] =
        (summary.byClass[coach.coachClass] || 0) + declaredCapacity;
      summary.byReservationType[coach.reservationType] =
        (summary.byReservationType[coach.reservationType] || 0) + declaredCapacity;
      summary.coaches.push({
        coachId: coach.id,
        coachNumber: coach.coachNumber,
        coachClass: coach.coachClass,
        reservationType: coach.reservationType,
        declaredCapacity,
        configuredSeatCount,
        capacityDifference: declaredCapacity - configuredSeatCount,
      });
    }

    summary.totalCapacity = summary.declaredCapacity;
    summary.capacityDifference = summary.declaredCapacity - summary.configuredSeatCount;
    summary.isConfigurationConsistent = summary.capacityDifference === 0;
    return summary;
  }

  async #ensureNumberAvailable(trainNumber, currentTrainId, options) {
    const existing = await this.trainRepository.findByNumber(trainNumber, options);
    if (existing && existing.id !== currentTrainId) {
      throw new ConflictError('Train number already exists', { trainNumber });
    }
  }

  #normalizeNumber(trainNumber) {
    if (typeof trainNumber !== 'string' || !trainNumber.trim()) {
      throw new ValidationError('trainNumber is required');
    }
    return trainNumber.trim().toUpperCase();
  }
}

module.exports = TrainService;
