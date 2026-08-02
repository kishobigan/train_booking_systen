'use strict';

const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const COACH_CLASS = require('../../common/constants/coach-class.constants');
const RESERVATION_TYPE = require('../../common/constants/coach-reservation-type.constants');
const sequelize = require('../../database/sequelize');
const CoachRepository = require('./coach.repository');
const SeatRepository = require('../seats/seat.repository');
const TrainRepository = require('../trains/train.repository');
const { normalizeCoachInput } = require('./coach.dto');

class CoachService {
  constructor({
    coachRepository = new CoachRepository(),
    seatRepository = new SeatRepository(),
    trainRepository = new TrainRepository(),
    transactionProvider = sequelize,
  } = {}) {
    this.coachRepository = coachRepository;
    this.seatRepository = seatRepository;
    this.trainRepository = trainRepository;
    this.transactionProvider = transactionProvider;
  }

  async createCoach(input, options = {}) {
    const values = normalizeCoachInput(input);
    this.#validateCoach(values, true);
    await this.#getTrain(values.trainId, options);
    await this.#ensureUniquePlacement(values, null, options);
    return this.coachRepository.create(values, options);
  }

  async getCoach(id, options = {}) {
    const coach = await this.coachRepository.findById(id, options);
    if (!coach) throw new NotFoundError('Coach not found', { id });
    return coach;
  }

  async getCoachWithSeats(id, options = {}) {
    const coach = await this.coachRepository.findWithSeats(id, options);
    if (!coach) throw new NotFoundError('Coach not found', { id });
    return coach;
  }

  listCoaches(trainId, options = {}) {
    if (!trainId) throw new ValidationError('trainId is required');
    return this.coachRepository.findByTrain(trainId, options);
  }

  async updateCoach(id, input, options = {}) {
    const coach = await this.getCoach(id, options);
    const values = normalizeCoachInput(input);
    if (!Object.keys(values).length)
      throw new ValidationError('At least one coach field is required');
    this.#validateCoach(values, false);
    const placement = {
      trainId: values.trainId ?? coach.trainId,
      coachNumber: values.coachNumber ?? coach.coachNumber,
      positionNumber: values.positionNumber ?? coach.positionNumber,
    };
    if (values.trainId !== undefined) await this.#getTrain(values.trainId, options);
    await this.#ensureUniquePlacement(placement, id, options);
    return coach.update(values, options);
  }

  async deleteCoach(id, options = {}) {
    const coach = await this.getCoach(id, options);
    await coach.destroy(options);
    return true;
  }

  generateSeats(coachId, configuration = {}, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const coach = await this.getCoach(coachId, transactionOptions);
      const existingCount = await this.seatRepository.count({ coachId }, transactionOptions);
      if (existingCount && !configuration.replace) {
        throw new ConflictError('Coach already has seats; set replace=true to regenerate them', {
          coachId,
          existingCount,
        });
      }

      const layout = this.#normalizeLayout(configuration, coach);
      const seats = this.#buildSeats(coachId, layout);
      if (existingCount) await this.seatRepository.deleteByCoach(coachId, transactionOptions);
      const createdSeats = await this.seatRepository.bulkCreate(seats, {
        ...transactionOptions,
        validate: true,
      });
      await coach.update(
        {
          totalSeats: seats.length,
          seatLayout: {
            rows: layout.rows,
            columns: layout.columns,
            columnLabels: layout.columnLabels,
            aisleAfterColumns: layout.aisleAfterColumns,
            seatPrefix: layout.seatPrefix,
          },
        },
        transactionOptions
      );
      return createdSeats;
    });
  }

  #normalizeLayout(configuration, coach) {
    const storedLayout = coach.seatLayout || {};
    const rows = Number(configuration.rows ?? storedLayout.rows);
    const columns = Number(configuration.columns ?? storedLayout.columns);
    const totalSeats = Number(configuration.totalSeats ?? coach.totalSeats);
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(columns) || columns < 1) {
      throw new ValidationError('Seat layout rows and columns must be positive integers');
    }
    if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > rows * columns) {
      throw new ValidationError('totalSeats must be between 1 and the layout capacity');
    }

    const storedColumnLabels = Array.isArray(storedLayout.columnLabels)
      ? storedLayout.columnLabels
      : null;
    const columnLabels =
      configuration.columnLabels ??
      (storedColumnLabels?.length === columns
        ? storedColumnLabels
        : Array.from({ length: columns }, (_, index) => this.#columnLabel(index)));
    if (
      !Array.isArray(columnLabels) ||
      columnLabels.length !== columns ||
      new Set(columnLabels).size !== columns
    ) {
      throw new ValidationError('columnLabels must contain one unique label per column');
    }

    const storedAisles = Array.isArray(storedLayout.aisleAfterColumns)
      ? storedLayout.aisleAfterColumns
      : null;
    const storedAislesAreValid = storedAisles?.every(
      (column) => Number.isInteger(column) && column >= 1 && column < columns
    );
    const aisleAfterColumns =
      configuration.aisleAfterColumns ??
      (storedAislesAreValid ? storedAisles : columns > 1 ? [Math.floor(columns / 2)] : []);
    if (
      !Array.isArray(aisleAfterColumns) ||
      aisleAfterColumns.some(
        (column) => !Number.isInteger(column) || column < 1 || column >= columns
      )
    ) {
      throw new ValidationError('aisleAfterColumns must contain valid column boundaries');
    }

    return {
      rows,
      columns,
      totalSeats,
      columnLabels: columnLabels.map(String),
      aisleAfterColumns,
      seatPrefix: String(configuration.seatPrefix ?? storedLayout.seatPrefix ?? ''),
      seatType: configuration.seatType ?? 'STANDARD',
      accessibleSeats: new Set((configuration.accessibleSeats ?? []).map(String)),
    };
  }

  #buildSeats(coachId, layout) {
    const seats = [];
    for (let row = 1; row <= layout.rows && seats.length < layout.totalSeats; row += 1) {
      for (
        let column = 1;
        column <= layout.columns && seats.length < layout.totalSeats;
        column += 1
      ) {
        const seatNumber = `${layout.seatPrefix}${row}${layout.columnLabels[column - 1]}`;
        seats.push({
          coachId,
          seatNumber,
          rowNumber: row,
          columnNumber: column,
          seatType: layout.seatType,
          isWindow: column === 1 || column === layout.columns,
          isAisle: layout.aisleAfterColumns.some(
            (boundary) => column === boundary || column === boundary + 1
          ),
          isAccessible: layout.accessibleSeats.has(seatNumber),
          isActive: true,
        });
      }
    }
    return seats;
  }

  #withTransaction(options, operation) {
    if (options.transaction) return operation(options);
    return this.transactionProvider.transaction((transaction) =>
      operation({ ...options, transaction })
    );
  }

  async #ensureUniquePlacement(values, currentCoachId, options) {
    const [sameNumber, samePosition] = await Promise.all([
      this.coachRepository.findByTrainAndNumber(values.trainId, values.coachNumber, options),
      this.coachRepository.findByTrainAndPosition(values.trainId, values.positionNumber, options),
    ]);
    if (sameNumber && sameNumber.id !== currentCoachId) {
      throw new ConflictError('Coach number already exists on this train');
    }
    if (samePosition && samePosition.id !== currentCoachId) {
      throw new ConflictError('Coach position is already occupied on this train');
    }
  }

  async #getTrain(id, options) {
    const train = await this.trainRepository.findById(id, options);
    if (!train) throw new NotFoundError('Train not found', { id });
    return train;
  }

  #validateCoach(values, requireAll) {
    const required = ['trainId', 'coachNumber', 'coachClass', 'reservationType', 'positionNumber'];
    if (
      requireAll &&
      required.some((field) => values[field] === undefined || values[field] === '')
    ) {
      throw new ValidationError(
        'Train, coach number, class, reservation type and position are required'
      );
    }
    if (
      values.positionNumber !== undefined &&
      (!Number.isInteger(values.positionNumber) || values.positionNumber < 1)
    ) {
      throw new ValidationError('positionNumber must be a positive integer');
    }
    if (
      values.totalSeats !== undefined &&
      (!Number.isInteger(values.totalSeats) || values.totalSeats < 0)
    ) {
      throw new ValidationError('totalSeats must be a nonnegative integer');
    }
    if (
      values.coachClass !== undefined &&
      !Object.values(COACH_CLASS).includes(values.coachClass)
    ) {
      throw new ValidationError('Invalid coachClass');
    }
    if (
      values.reservationType !== undefined &&
      !Object.values(RESERVATION_TYPE).includes(values.reservationType)
    ) {
      throw new ValidationError('Invalid reservationType');
    }
  }

  #columnLabel(index) {
    let value = index + 1;
    let label = '';
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
  }
}

module.exports = CoachService;
