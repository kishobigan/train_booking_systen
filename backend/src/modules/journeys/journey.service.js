'use strict';

const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const JOURNEY_STATUS = require('../../common/constants/journey-status.constants');
const SEAT_STATUS = require('../../common/constants/seat-status.constants');
const sequelize = require('../../database/sequelize');
const JourneyRepository = require('./journey.repository');
const JourneyStationRepository = require('./journey-station.repository');
const JourneyCoachRepository = require('./journey-coach.repository');
const JourneySeatRepository = require('./journey-seat.repository');
const RouteRepository = require('../routes/route.repository');
const TrainRepository = require('../trains/train.repository');
const { normalizeJourneyInput } = require('./journey.dto');

class JourneyService {
  constructor({
    journeyRepository = new JourneyRepository(),
    journeyStationRepository = new JourneyStationRepository(),
    journeyCoachRepository = new JourneyCoachRepository(),
    journeySeatRepository = new JourneySeatRepository(),
    routeRepository = new RouteRepository(),
    trainRepository = new TrainRepository(),
    transactionProvider = sequelize,
  } = {}) {
    this.journeyRepository = journeyRepository;
    this.journeyStationRepository = journeyStationRepository;
    this.journeyCoachRepository = journeyCoachRepository;
    this.journeySeatRepository = journeySeatRepository;
    this.routeRepository = routeRepository;
    this.trainRepository = trainRepository;
    this.transactionProvider = transactionProvider;
  }

  async createJourney(input, options = {}) {
    const values = normalizeJourneyInput(input);
    this.#validateJourney(values, true);
    await Promise.all([
      this.#getRoute(values.routeId, options),
      this.#getTrain(values.trainId, options),
    ]);
    await this.#ensureDepartureAvailable(
      values.trainId,
      values.scheduledDepartureAt,
      null,
      options
    );
    return this.journeyRepository.create(values, options);
  }

  async getJourney(id, options = {}) {
    const journey = await this.journeyRepository.findById(id, options);
    if (!journey) throw new NotFoundError('Journey not found', { id });
    return journey;
  }

  async getJourneySnapshot(id, options = {}) {
    const journey = await this.journeyRepository.findSnapshot(id, options);
    if (!journey) throw new NotFoundError('Journey not found', { id });
    return journey;
  }

  searchJourneys(filters = {}, options = {}) {
    return this.journeyRepository.search(filters, options);
  }

  async updateJourney(id, input, options = {}) {
    const journey = await this.getJourney(id, options);
    const values = normalizeJourneyInput(input);
    if (!Object.keys(values).length)
      throw new ValidationError('At least one journey field is required');
    this.#validateJourney(
      {
        ...values,
        scheduledDepartureAt: values.scheduledDepartureAt ?? journey.scheduledDepartureAt,
        scheduledArrivalAt: values.scheduledArrivalAt ?? journey.scheduledArrivalAt,
      },
      false
    );
    if (values.routeId !== undefined) await this.#getRoute(values.routeId, options);
    if (values.trainId !== undefined) await this.#getTrain(values.trainId, options);
    const trainId = values.trainId ?? journey.trainId;
    const departure = values.scheduledDepartureAt ?? journey.scheduledDepartureAt;
    await this.#ensureDepartureAvailable(trainId, departure, id, options);
    return journey.update(values, options);
  }

  async deleteJourney(id, options = {}) {
    const journey = await this.getJourney(id, options);
    await journey.destroy(options);
    return true;
  }

  generateSnapshots(id, { replace = false, ...options } = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const journey = await this.getJourney(id, transactionOptions);
      if ([JOURNEY_STATUS.CANCELLED, JOURNEY_STATUS.COMPLETED].includes(journey.status)) {
        throw new ConflictError('Snapshots cannot be generated for a closed journey');
      }
      const existingCount = await this.journeyStationRepository.count(
        { journeyId: id },
        transactionOptions
      );
      if (existingCount && !replace) {
        throw new ConflictError('Journey snapshots already exist; set replace=true to regenerate');
      }

      const [route, train] = await Promise.all([
        this.routeRepository.findWithStations(journey.routeId, transactionOptions),
        this.trainRepository.findConfiguration(journey.trainId, transactionOptions),
      ]);
      if (!route) throw new NotFoundError('Route not found', { id: journey.routeId });
      if (!train) throw new NotFoundError('Train not found', { id: journey.trainId });
      if (!route.routeStations?.length) throw new ValidationError('Route has no stations');

      if (existingCount) {
        await this.journeySeatRepository.deleteByJourney(id, transactionOptions);
        await this.journeyCoachRepository.deleteByJourney(id, transactionOptions);
        await this.journeyStationRepository.deleteByJourney(id, transactionOptions);
      }

      const departure = new Date(journey.scheduledDepartureAt);
      const stationSnapshots = route.routeStations.map((routeStation) => ({
        journeyId: id,
        stationId: routeStation.stationId,
        sequenceNumber: routeStation.sequenceNumber,
        distanceFromStartKm: routeStation.distanceFromStartKm,
        scheduledArrivalAt: this.#addMinutes(departure, routeStation.defaultArrivalOffsetMinutes),
        scheduledDepartureAt: this.#addMinutes(
          departure,
          routeStation.defaultDepartureOffsetMinutes
        ),
        canBoard: routeStation.canBoard,
        canAlight: routeStation.canAlight,
      }));
      const createdStations = await this.journeyStationRepository.bulkCreate(
        stationSnapshots,
        transactionOptions
      );

      const physicalCoaches = (train.coaches || []).filter((coach) => coach.isActive);
      const coachSnapshots = physicalCoaches.map((coach) => ({
        journeyId: id,
        coachId: coach.id,
        coachNumberSnapshot: coach.coachNumber,
        coachClassSnapshot: coach.coachClass,
        reservationTypeSnapshot: coach.reservationType,
        positionNumber: coach.positionNumber,
        isAvailable: true,
      }));
      const createdCoaches = await this.journeyCoachRepository.bulkCreate(
        coachSnapshots,
        transactionOptions
      );
      const journeyCoachByCoachId = new Map(
        createdCoaches.map((journeyCoach) => [journeyCoach.coachId, journeyCoach])
      );
      const seatSnapshots = physicalCoaches.flatMap((coach) =>
        (coach.seats || [])
          .filter((seat) => seat.isActive)
          .map((seat) => ({
            journeyId: id,
            journeyCoachId: journeyCoachByCoachId.get(coach.id).id,
            seatId: seat.id,
            seatNumberSnapshot: seat.seatNumber,
            status: SEAT_STATUS.AVAILABLE,
          }))
      );
      const createdSeats = seatSnapshots.length
        ? await this.journeySeatRepository.bulkCreate(seatSnapshots, transactionOptions)
        : [];
      return { journey, stations: createdStations, coaches: createdCoaches, seats: createdSeats };
    });
  }

  cancelJourney(id, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const journey = await this.#getJourneyForUpdate(id, transactionOptions);
      if (journey.status === JOURNEY_STATUS.COMPLETED) {
        throw new ConflictError('A completed journey cannot be cancelled');
      }
      if (journey.status === JOURNEY_STATUS.CANCELLED) return journey;
      return journey.update({ status: JOURNEY_STATUS.CANCELLED }, transactionOptions);
    });
  }

  delayJourney(id, delayMinutes, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      if (!Number.isInteger(delayMinutes) || delayMinutes < 1) {
        throw new ValidationError('delayMinutes must be a positive integer');
      }
      const journey = await this.#getJourneyForUpdate(id, transactionOptions);
      if ([JOURNEY_STATUS.CANCELLED, JOURNEY_STATUS.COMPLETED].includes(journey.status)) {
        throw new ConflictError('A closed journey cannot be delayed');
      }
      const updates = {
        status: JOURNEY_STATUS.DELAYED,
        scheduledDepartureAt: this.#addMinutes(journey.scheduledDepartureAt, delayMinutes),
        scheduledArrivalAt: this.#addMinutes(journey.scheduledArrivalAt, delayMinutes),
      };
      const stations = await this.journeyStationRepository.findByJourney(id, {
        ...transactionOptions,
        include: [],
      });
      for (const station of stations) {
        await station.update(
          {
            scheduledArrivalAt: this.#addMinutes(station.scheduledArrivalAt, delayMinutes),
            scheduledDepartureAt: this.#addMinutes(station.scheduledDepartureAt, delayMinutes),
          },
          transactionOptions
        );
      }
      return journey.update(updates, transactionOptions);
    });
  }

  completeJourney(id, actualArrivalAt = new Date(), options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const journey = await this.#getJourneyForUpdate(id, transactionOptions);
      if (journey.status === JOURNEY_STATUS.CANCELLED) {
        throw new ConflictError('A cancelled journey cannot be completed');
      }
      if (journey.status === JOURNEY_STATUS.DRAFT) {
        throw new ConflictError('A draft journey cannot be completed');
      }
      if (journey.status === JOURNEY_STATUS.COMPLETED) return journey;
      const arrival = new Date(actualArrivalAt);
      if (Number.isNaN(arrival.getTime())) throw new ValidationError('actualArrivalAt is invalid');
      return journey.update(
        { status: JOURNEY_STATUS.COMPLETED, actualArrivalAt: arrival },
        transactionOptions
      );
    });
  }

  #withTransaction(options, operation) {
    if (options.transaction) return operation(options);
    return this.transactionProvider.transaction((transaction) =>
      operation({ ...options, transaction })
    );
  }

  async #getJourneyForUpdate(id, options) {
    const lock = options.transaction?.LOCK?.UPDATE;
    return this.getJourney(id, { ...options, ...(lock && { lock }) });
  }

  async #ensureDepartureAvailable(trainId, departure, currentJourneyId, options) {
    const existing = await this.journeyRepository.findByTrainAndDeparture(
      trainId,
      departure,
      options
    );
    if (existing && existing.id !== currentJourneyId) {
      throw new ConflictError('The train already has a journey at this departure time');
    }
  }

  async #getRoute(id, options) {
    const route = await this.routeRepository.findById(id, options);
    if (!route) throw new NotFoundError('Route not found', { id });
    return route;
  }

  async #getTrain(id, options) {
    const train = await this.trainRepository.findById(id, options);
    if (!train) throw new NotFoundError('Train not found', { id });
    return train;
  }

  #validateJourney(values, requireAll) {
    const required = ['routeId', 'trainId', 'serviceNumber', 'journeyDate', 'scheduledDepartureAt'];
    if (requireAll && required.some((field) => !values[field])) {
      throw new ValidationError('Route, train, service number, date and departure are required');
    }
    if (values.status && !Object.values(JOURNEY_STATUS).includes(values.status)) {
      throw new ValidationError('Invalid journey status');
    }
    const departure = values.scheduledDepartureAt && new Date(values.scheduledDepartureAt);
    const arrival = values.scheduledArrivalAt && new Date(values.scheduledArrivalAt);
    if (departure && Number.isNaN(departure.getTime())) {
      throw new ValidationError('scheduledDepartureAt is invalid');
    }
    if (arrival && Number.isNaN(arrival.getTime())) {
      throw new ValidationError('scheduledArrivalAt is invalid');
    }
    if (departure && arrival && arrival <= departure) {
      throw new ValidationError('scheduledArrivalAt must be after scheduledDepartureAt');
    }
  }

  #addMinutes(date, minutes) {
    if (date == null || minutes == null) return null;
    const value = new Date(date);
    return new Date(value.getTime() + Number(minutes) * 60_000);
  }
}

module.exports = JourneyService;
