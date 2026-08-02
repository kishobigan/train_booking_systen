'use strict';

const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const sequelize = require('../../database/sequelize');
const SeatRepository = require('./seat.repository');
const CoachRepository = require('../coaches/coach.repository');
const { normalizeSeatInput } = require('./seat.dto');

class SeatService {
  constructor({
    seatRepository = new SeatRepository(),
    coachRepository = new CoachRepository(),
    transactionProvider = sequelize,
  } = {}) {
    this.seatRepository = seatRepository;
    this.coachRepository = coachRepository;
    this.transactionProvider = transactionProvider;
  }

  createSeat(input, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const values = normalizeSeatInput(input);
      this.#validateSeat(values, true);
      const coach = await this.#getCoach(values.coachId, transactionOptions);
      await this.#ensureNumberAvailable(
        values.coachId,
        values.seatNumber,
        null,
        transactionOptions
      );
      const seat = await this.seatRepository.create(values, transactionOptions);
      await this.#syncCoachCapacity(coach, transactionOptions);
      return seat;
    });
  }

  async getSeat(id, options = {}) {
    const seat = await this.seatRepository.findById(id, options);
    if (!seat) throw new NotFoundError('Seat not found', { id });
    return seat;
  }

  async getSeatByNumber(coachId, seatNumber, options = {}) {
    const normalizedNumber = this.#normalizeNumber(seatNumber);
    const seat = await this.seatRepository.findByCoachAndNumber(coachId, normalizedNumber, options);
    if (!seat) throw new NotFoundError('Seat not found', { coachId, seatNumber: normalizedNumber });
    return seat;
  }

  listSeats(coachId, filters = {}, options = {}) {
    if (!coachId) throw new ValidationError('coachId is required');
    const where = { coachId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.seatType) where.seatType = String(filters.seatType).trim().toUpperCase();
    if (filters.isAccessible !== undefined) where.isAccessible = filters.isAccessible;
    return this.seatRepository.paginate(where, {
      ...options,
      page: filters.page,
      pageSize: filters.pageSize,
      order: options.order || [['seatNumber', 'ASC']],
    });
  }

  updateSeat(id, input, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const seat = await this.getSeat(id, transactionOptions);
      const values = normalizeSeatInput(input);
      if (!Object.keys(values).length)
        throw new ValidationError('At least one seat field is required');
      this.#validateSeat(values, false);
      const sourceCoach = await this.#getCoach(seat.coachId, transactionOptions);
      const targetCoachId = values.coachId ?? seat.coachId;
      const targetCoach =
        targetCoachId === seat.coachId
          ? sourceCoach
          : await this.#getCoach(targetCoachId, transactionOptions);
      const targetNumber = values.seatNumber ?? seat.seatNumber;
      await this.#ensureNumberAvailable(targetCoachId, targetNumber, id, transactionOptions);
      const updated = await seat.update(values, transactionOptions);
      await this.#syncCoachCapacity(sourceCoach, transactionOptions);
      if (targetCoach.id !== sourceCoach.id) {
        await this.#syncCoachCapacity(targetCoach, transactionOptions);
      }
      return updated;
    });
  }

  deleteSeat(id, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const seat = await this.getSeat(id, transactionOptions);
      const coach = await this.#getCoach(seat.coachId, transactionOptions);
      await seat.destroy(transactionOptions);
      await this.#syncCoachCapacity(coach, transactionOptions);
      return true;
    });
  }

  bulkCreateSeats(coachId, inputs, { replace = false, ...options } = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const coach = await this.#getCoach(coachId, transactionOptions);
      if (!Array.isArray(inputs) || inputs.length === 0) {
        throw new ValidationError('At least one seat is required');
      }
      if (inputs.length > 500) throw new ValidationError('A seat batch cannot exceed 500 records');

      const values = inputs.map((input) => normalizeSeatInput({ ...input, coachId }));
      values.forEach((seat) => this.#validateSeat(seat, true));
      const seatNumbers = values.map((seat) => seat.seatNumber);
      if (new Set(seatNumbers).size !== seatNumbers.length) {
        throw new ConflictError('The seat batch contains duplicate seat numbers');
      }

      const existingCount = await this.seatRepository.count({ coachId }, transactionOptions);
      if (replace) {
        if (existingCount) await this.seatRepository.deleteByCoach(coachId, transactionOptions);
      } else {
        const conflicts = await this.seatRepository.findByCoachAndNumbers(
          coachId,
          seatNumbers,
          transactionOptions
        );
        if (conflicts.length) {
          throw new ConflictError('One or more seat numbers already exist', {
            seatNumbers: conflicts.map((seat) => seat.seatNumber),
          });
        }
      }

      const created = await this.seatRepository.bulkCreate(values, {
        ...transactionOptions,
        validate: true,
      });
      await this.#syncCoachCapacity(coach, transactionOptions);
      return created;
    });
  }

  #withTransaction(options, operation) {
    if (options.transaction) return operation(options);
    return this.transactionProvider.transaction((transaction) =>
      operation({ ...options, transaction })
    );
  }

  async #syncCoachCapacity(coach, options) {
    const totalSeats = await this.seatRepository.count({ coachId: coach.id }, options);
    await coach.update({ totalSeats }, options);
  }

  async #ensureNumberAvailable(coachId, seatNumber, currentSeatId, options) {
    const existing = await this.seatRepository.findByCoachAndNumber(coachId, seatNumber, options);
    if (existing && existing.id !== currentSeatId) {
      throw new ConflictError('Seat number already exists in this coach', {
        coachId,
        seatNumber,
      });
    }
  }

  async #getCoach(id, options) {
    const coach = await this.coachRepository.findById(id, options);
    if (!coach) throw new NotFoundError('Coach not found', { id });
    return coach;
  }

  #validateSeat(values, requireAll) {
    if (requireAll && (!values.coachId || !values.seatNumber)) {
      throw new ValidationError('coachId and seatNumber are required');
    }
    for (const field of ['rowNumber', 'columnNumber']) {
      if (
        values[field] !== undefined &&
        values[field] !== null &&
        (!Number.isInteger(values[field]) || values[field] < 1)
      ) {
        throw new ValidationError(`${field} must be a positive integer`);
      }
    }
    if (values.seatNumber !== undefined && !values.seatNumber) {
      throw new ValidationError('seatNumber cannot be empty');
    }
  }

  #normalizeNumber(seatNumber) {
    if (typeof seatNumber !== 'string' || !seatNumber.trim()) {
      throw new ValidationError('seatNumber is required');
    }
    return seatNumber.trim().toUpperCase();
  }
}

module.exports = SeatService;
