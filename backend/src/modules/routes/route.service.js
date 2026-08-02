'use strict';

const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const sequelize = require('../../database/sequelize');
const RouteRepository = require('./route.repository');
const RouteStationRepository = require('./route-station.repository');
const StationRepository = require('../stations/station.repository');
const { normalizeRouteInput, normalizeRouteStationInput } = require('./route.dto');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const { normalizePagination, paginationMeta } = require('../../common/utils/pagination');

class RouteService {
  constructor({
    routeRepository = new RouteRepository(),
    routeStationRepository = new RouteStationRepository(),
    stationRepository = new StationRepository(),
    transactionProvider = sequelize,
    journeyRepository,
    auditService,
  } = {}) {
    this.routeRepository = routeRepository;
    this.routeStationRepository = routeStationRepository;
    this.stationRepository = stationRepository;
    this.transactionProvider = transactionProvider;
    this.journeyRepository = journeyRepository;
    this.auditService = auditService;
  }

  async createRoute(input, options = {}) {
    const values = normalizeRouteInput(input);
    this.#validateRoute(values, true);
    await this.#ensureCodeAvailable(values.code, null, options);
    await this.#validateEndpoints(values.startStationId, values.endStationId, options);
    return this.routeRepository.create(values, options);
  }

  createRouteWithStations(input, options = {}) {
    this.#assertSuperAdmin(input.actor);
    return this.#withTransaction(options, async (transactionOptions) => {
      const values = normalizeRouteInput(input);
      this.#validateRoute(values, true);
      await this.#ensureCodeAvailable(values.code, null, transactionOptions);
      await this.#validateEndpoints(values.startStationId, values.endStationId, transactionOptions);
      const stations = this.#validateNewStationOrder(input.stations, values);
      await Promise.all(
        stations.map(async (item) => {
          const station = await this.#getStation(item.stationId, transactionOptions);
          if (!station.isActive) throw new ValidationError('Inactive stations cannot be added');
        })
      );
      const totalDistanceKm = stations.at(-1).distanceFromStartKm;
      const route = await this.routeRepository.create(
        { ...values, totalDistanceKm },
        transactionOptions
      );
      await this.routeStationRepository.bulkCreate(
        stations.map((item) => ({ routeId: route.id, ...item })),
        transactionOptions
      );
      await this.#audit(route, 'ROUTE_CREATED', input.actor, transactionOptions);
      return this.getRouteWithStations(route.id, transactionOptions);
    });
  }

  async getRoute(id, options = {}) {
    const route = await this.routeRepository.findById(id, options);
    if (!route) throw new NotFoundError('Route not found', { id });
    return route;
  }

  async getRouteByCode(code, options = {}) {
    const normalizedCode = this.#normalizeCode(code);
    const route = await this.routeRepository.findByCode(normalizedCode, options);
    if (!route) throw new NotFoundError('Route not found', { code: normalizedCode });
    return route;
  }

  async getRouteWithStations(id, options = {}) {
    const route = await this.routeRepository.findWithStations(id, options);
    if (!route) throw new NotFoundError('Route not found', { id });
    return route;
  }

  listRoutes(filters = {}, options = {}) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.routeRepository.paginate(where, {
      ...options,
      page: filters.page,
      pageSize: filters.pageSize,
      order: options.order || [['name', 'ASC']],
    });
  }

  async getRoutes(filters = {}, options = {}) {
    const { page, limit, offset } = normalizePagination(filters);
    const result = await this.routeRepository.findAllPaginated(filters, {
      ...options,
      limit,
      offset,
      order: [['name', 'ASC']],
    });
    return {
      items: result.rows,
      pagination: paginationMeta({ page, limit, totalItems: result.count }),
    };
  }

  async updateRoute(id, input, options = {}) {
    const route = await this.getRoute(id, options);
    const values = normalizeRouteInput(input);
    if (!Object.keys(values).length)
      throw new ValidationError('At least one route field is required');
    if (values.code !== undefined) await this.#ensureCodeAvailable(values.code, id, options);
    const startStationId = values.startStationId ?? route.startStationId;
    const endStationId = values.endStationId ?? route.endStationId;
    await this.#validateEndpoints(startStationId, endStationId, options);
    return route.update(values, options);
  }

  async deleteRoute(id, options = {}) {
    const route = await this.getRoute(id, options);
    await route.destroy(options);
    return true;
  }

  async deactivateRoute(id, actor, options = {}) {
    this.#assertSuperAdmin(actor);
    const route = await this.getRoute(id, options);
    const journeyCount = this.journeyRepository
      ? await this.journeyRepository.count({ routeId: id }, options)
      : 1;
    if (journeyCount > 0) {
      await route.update({ isActive: false }, options);
      await this.#audit(route, 'ROUTE_DEACTIVATED', actor, options);
      return { id: route.id, isActive: false, deletionMode: 'DEACTIVATED' };
    }
    await route.destroy(options);
    await this.#audit(route, 'ROUTE_DELETED', actor, options);
    return { id: route.id, isActive: false, deletionMode: 'DELETED' };
  }

  addStation(routeId, input, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const route = await this.getRoute(routeId, transactionOptions);
      const values = normalizeRouteStationInput(input);
      if (!values.stationId) throw new ValidationError('stationId is required');
      if (values.distanceFromStartKm === undefined || Number(values.distanceFromStartKm) < 0) {
        throw new ValidationError('A nonnegative distanceFromStartKm is required');
      }
      await this.#getStation(values.stationId, transactionOptions);
      const duplicate = await this.routeStationRepository.findByRouteAndStation(
        routeId,
        values.stationId,
        transactionOptions
      );
      if (duplicate) throw new ConflictError('Station already belongs to this route');

      const records = await this.#getLockedRouteStations(routeId, transactionOptions);
      const requestedSequence = input.sequenceNumber ?? records.length;
      if (
        !Number.isInteger(requestedSequence) ||
        requestedSequence < 0 ||
        requestedSequence > records.length
      ) {
        throw new ValidationError('sequenceNumber is outside the route bounds');
      }
      const temporarySequence = this.#temporarySequence(records);
      const created = await this.routeStationRepository.create(
        { ...values, routeId, sequenceNumber: temporarySequence },
        transactionOptions
      );
      const orderedIds = records.map((record) => record.id);
      orderedIds.splice(requestedSequence, 0, created.id);
      const allRecords = [...records, created];
      this.#validateDistanceOrder(allRecords, orderedIds);
      await this.#resequence(allRecords, orderedIds, transactionOptions);
      await this.#syncEndpoints(route, allRecords, orderedIds, transactionOptions);
      return created.reload ? created.reload(transactionOptions) : created;
    });
  }

  removeStation(routeId, routeStationId, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const route = await this.getRoute(routeId, transactionOptions);
      const records = await this.#getLockedRouteStations(routeId, transactionOptions);
      const target = records.find((record) => record.id === routeStationId);
      if (!target) throw new NotFoundError('Route station not found', { routeId, routeStationId });
      if (records.length <= 2) {
        throw new ValidationError('A route must retain at least two stations');
      }
      await target.destroy(transactionOptions);
      const remaining = records.filter((record) => record.id !== routeStationId);
      const orderedIds = remaining.map((record) => record.id);
      await this.#resequence(remaining, orderedIds, transactionOptions);
      await this.#syncEndpoints(route, remaining, orderedIds, transactionOptions);
      return true;
    });
  }

  reorderStations(routeId, orderedRouteStationIds, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const route = await this.getRoute(routeId, transactionOptions);
      const records = await this.#getLockedRouteStations(routeId, transactionOptions);
      this.#validateOrdering(records, orderedRouteStationIds);
      await this.#resequence(records, orderedRouteStationIds, transactionOptions);
      await this.#syncEndpoints(route, records, orderedRouteStationIds, transactionOptions);
      return this.routeStationRepository.findByRoute(routeId, transactionOptions);
    });
  }

  reorderRouteStations(routeId, stations, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const records = await this.#getLockedRouteStations(routeId, transactionOptions);
      const orderedIds = stations.map((item) => item.routeStationId);
      this.#validateOrdering(records, orderedIds);
      const byId = new Map(records.map((record) => [record.id, record]));
      const distances = stations.map((item) => Number(item.distanceFromStartKm));
      if (
        distances[0] !== 0 ||
        distances.some((value, index) => index && value < distances[index - 1])
      )
        throw new ValidationError('Route distances must start at zero and never decrease');
      for (const item of stations)
        await byId
          .get(item.routeStationId)
          .update({ distanceFromStartKm: item.distanceFromStartKm }, transactionOptions);
      await this.#resequence(records, orderedIds, transactionOptions);
      const route = await this.getRoute(routeId, transactionOptions);
      await this.#syncEndpoints(route, records, orderedIds, transactionOptions);
      await route.update({ totalDistanceKm: distances.at(-1) }, transactionOptions);
      return this.routeStationRepository.findByRoute(routeId, transactionOptions);
    });
  }

  updateRouteStation(routeId, routeStationId, input, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const records = await this.#getLockedRouteStations(routeId, transactionOptions);
      const record = records.find((item) => item.id === routeStationId);
      if (!record) throw new NotFoundError('Route station not found');
      const values = normalizeRouteStationInput(input);
      delete values.stationId;
      await record.update(values, transactionOptions);
      const ordered = [...records].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const distances = ordered.map((item) => Number(item.distanceFromStartKm));
      if (
        distances[0] !== 0 ||
        distances.some((value, index) => index && value < distances[index - 1])
      )
        throw new ValidationError('Route station distances are invalid');
      const route = await this.getRoute(routeId, transactionOptions);
      await route.update({ totalDistanceKm: distances.at(-1) }, transactionOptions);
      return record;
    });
  }

  cloneReverseRoute(routeId, overrides = {}, options = {}) {
    return this.#withTransaction(options, async (transactionOptions) => {
      const source = await this.getRoute(routeId, transactionOptions);
      const sourceStations = await this.#getLockedRouteStations(routeId, transactionOptions);
      if (sourceStations.length < 2) {
        throw new ValidationError(
          'A route requires at least two stations to create a reverse clone'
        );
      }

      const values = normalizeRouteInput({
        code: `${source.code}-REV`,
        name: `${source.name} (Reverse)`,
        description: source.description,
        startStationId: source.endStationId,
        endStationId: source.startStationId,
        totalDistanceKm: source.totalDistanceKm,
        isActive: source.isActive,
        ...overrides,
      });
      this.#validateRoute(values, true);
      await this.#ensureCodeAvailable(values.code, null, transactionOptions);
      await this.#validateEndpoints(values.startStationId, values.endStationId, transactionOptions);
      const reverseRoute = await this.routeRepository.create(values, transactionOptions);

      const totalDistance = Number(
        source.totalDistanceKm ?? sourceStations[sourceStations.length - 1].distanceFromStartKm
      );
      const totalOffset = Math.max(
        ...sourceStations.flatMap((record) => [
          Number(record.defaultArrivalOffsetMinutes ?? 0),
          Number(record.defaultDepartureOffsetMinutes ?? 0),
        ])
      );
      const reversed = [...sourceStations].reverse().map((record, sequenceNumber) => ({
        routeId: reverseRoute.id,
        stationId: record.stationId,
        sequenceNumber,
        distanceFromStartKm: totalDistance - Number(record.distanceFromStartKm),
        defaultArrivalOffsetMinutes: this.#reverseOffset(
          totalOffset,
          record.defaultDepartureOffsetMinutes
        ),
        defaultDepartureOffsetMinutes: this.#reverseOffset(
          totalOffset,
          record.defaultArrivalOffsetMinutes
        ),
        stopDurationMinutes: record.stopDurationMinutes,
        canBoard: record.canAlight,
        canAlight: record.canBoard,
      }));
      await this.routeStationRepository.bulkCreate(reversed, transactionOptions);
      return this.getRouteWithStations(reverseRoute.id, transactionOptions);
    });
  }

  #withTransaction(options, operation) {
    if (options.transaction) return operation(options);
    return this.transactionProvider.transaction((transaction) =>
      operation({ ...options, transaction })
    );
  }

  async #getLockedRouteStations(routeId, options) {
    const lock = options.transaction?.LOCK?.UPDATE;
    return this.routeStationRepository.findByRoute(routeId, {
      ...options,
      include: [],
      ...(lock && { lock }),
    });
  }

  async #resequence(records, orderedIds, options) {
    if (!records.length) return;
    const byId = new Map(records.map((record) => [record.id, record]));
    const temporaryStart = this.#temporarySequence(records);
    for (const [index, id] of orderedIds.entries()) {
      await byId.get(id).update({ sequenceNumber: temporaryStart + index }, options);
    }
    for (const [sequenceNumber, id] of orderedIds.entries()) {
      await byId.get(id).update({ sequenceNumber }, options);
    }
  }

  #temporarySequence(records) {
    return (
      Math.max(-1, ...records.map((record) => Number(record.sequenceNumber))) + records.length + 1
    );
  }

  #syncEndpoints(route, records, orderedIds, options) {
    if (orderedIds.length < 2) return route;
    const byId = new Map(records.map((record) => [record.id, record]));
    return route.update(
      {
        startStationId: byId.get(orderedIds[0]).stationId,
        endStationId: byId.get(orderedIds[orderedIds.length - 1]).stationId,
        totalDistanceKm: byId.get(orderedIds[orderedIds.length - 1]).distanceFromStartKm,
      },
      options
    );
  }

  #validateDistanceOrder(records, orderedIds) {
    const byId = new Map(records.map((record) => [record.id, record]));
    const distances = orderedIds.map((id) => Number(byId.get(id).distanceFromStartKm));
    if (
      distances.some(Number.isNaN) ||
      distances[0] !== 0 ||
      distances.some((value, index) => index && value < distances[index - 1])
    ) {
      throw new ValidationError('Route distances must start at zero and never decrease');
    }
  }

  #validateOrdering(records, orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length !== records.length) {
      throw new ValidationError('The reorder list must contain every route station exactly once');
    }
    const expected = new Set(records.map((record) => record.id));
    const provided = new Set(orderedIds);
    if (provided.size !== orderedIds.length || provided.size !== expected.size) {
      throw new ValidationError('The reorder list contains duplicate or missing route stations');
    }
    for (const id of provided) {
      if (!expected.has(id))
        throw new ValidationError('The reorder list contains another route’s station');
    }
  }

  async #ensureCodeAvailable(code, currentRouteId, options) {
    const existing = await this.routeRepository.findByCode(code, options);
    if (existing && existing.id !== currentRouteId) {
      throw new ConflictError('Route code already exists', { code });
    }
  }

  async #validateEndpoints(startStationId, endStationId, options) {
    if (!startStationId || !endStationId) {
      throw new ValidationError('startStationId and endStationId are required');
    }
    if (startStationId === endStationId) {
      throw new ValidationError('Route start and end stations must be different');
    }
    await Promise.all([
      this.#getStation(startStationId, options),
      this.#getStation(endStationId, options),
    ]);
  }

  async #getStation(id, options) {
    const station = await this.stationRepository.findById(id, options);
    if (!station) throw new NotFoundError('Station not found', { id });
    return station;
  }

  #validateRoute(values, requireAll) {
    const required = ['code', 'name', 'startStationId', 'endStationId'];
    if (requireAll && required.some((field) => !values[field])) {
      throw new ValidationError('Route code, name, start station and end station are required');
    }
    if (values.totalDistanceKm !== undefined && Number(values.totalDistanceKm) <= 0) {
      throw new ValidationError('totalDistanceKm must be positive');
    }
  }

  #normalizeCode(code) {
    if (typeof code !== 'string' || !code.trim())
      throw new ValidationError('A route code is required');
    return code.trim().toUpperCase();
  }

  #reverseOffset(totalOffset, offset) {
    return offset == null ? null : totalOffset - Number(offset);
  }

  #assertSuperAdmin(actor) {
    if (actor?.role !== 'SUPER_ADMIN')
      throw new AuthorizationError('Super administrator access is required');
  }

  #validateNewStationOrder(input, route) {
    if (!Array.isArray(input) || input.length < 2)
      throw new ValidationError('A route requires at least two stations');
    const stations = input.map((item) => ({
      ...normalizeRouteStationInput(item),
      sequenceNumber: Number(item.sequenceNumber),
    }));
    if (new Set(stations.map((item) => item.stationId)).size !== stations.length)
      throw new ValidationError('Route station IDs must be unique');
    stations.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (stations.some((item, index) => item.sequenceNumber !== index))
      throw new ValidationError('Route station sequences must be continuous from zero');
    if (
      stations[0].stationId !== route.startStationId ||
      stations.at(-1).stationId !== route.endStationId
    )
      throw new ValidationError('First and last route stations must match route endpoints');
    const distances = stations.map((item) => Number(item.distanceFromStartKm));
    if (
      distances.some(Number.isNaN) ||
      distances[0] !== 0 ||
      distances.some((value, index) => index && value < distances[index - 1])
    )
      throw new ValidationError('Route distances must start at zero and never decrease');
    return stations;
  }

  #audit(route, action, actor, options = {}) {
    if (!this.auditService?.record) return null;
    return this.auditService.record(
      { userId: actor?.id, action, entityType: 'Route', entityId: route.id },
      options.transaction ? { transaction: options.transaction } : options
    );
  }
}

module.exports = RouteService;
