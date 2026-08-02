'use strict';

const ConflictError = require('../../common/errors/ConflictError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const StationRepository = require('./station.repository');
const { normalizeStationInput } = require('./station.dto');

class StationService {
  constructor(stationRepository = new StationRepository()) {
    this.stationRepository = stationRepository;
  }

  async createStation(input, options = {}) {
    const values = normalizeStationInput(input);
    this.#validateRequiredFields(values);
    await this.#ensureCodeAvailable(values.code, null, options);
    return this.stationRepository.create(values, options);
  }

  async getStation(id, options = {}) {
    const station = await this.stationRepository.findById(id, options);
    if (!station) throw new NotFoundError('Station not found', { id });
    return station;
  }

  async getStationByCode(code, options = {}) {
    const normalizedCode = this.#normalizeCode(code);
    const station = await this.stationRepository.findByCode(normalizedCode, options);
    if (!station) throw new NotFoundError('Station not found', { code: normalizedCode });
    return station;
  }

  listStations(filters = {}, options = {}) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.city) where.city = filters.city.trim();
    if (filters.district) where.district = filters.district.trim();
    return this.stationRepository.paginate(where, {
      ...options,
      page: filters.page,
      pageSize: filters.pageSize,
      order: options.order || [['name', 'ASC']],
    });
  }

  searchStations(query, options = {}) {
    const term = typeof query === 'string' ? query.trim() : '';
    if (!term) throw new ValidationError('A station search term is required', { field: 'query' });
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    return this.stationRepository.search(term, { ...options, limit });
  }

  async updateStation(id, input, options = {}) {
    const station = await this.getStation(id, options);
    const values = normalizeStationInput(input);
    if (!Object.keys(values).length) {
      throw new ValidationError('At least one station field must be provided');
    }
    if (values.code !== undefined) await this.#ensureCodeAvailable(values.code, id, options);
    return station.update(values, options);
  }

  async deleteStation(id, options = {}) {
    const station = await this.getStation(id, options);
    await station.destroy(options);
    return true;
  }

  async #ensureCodeAvailable(code, currentStationId, options) {
    const existing = await this.stationRepository.findByCode(code, options);
    if (existing && existing.id !== currentStationId) {
      throw new ConflictError('Station code already exists', { code });
    }
  }

  #validateRequiredFields(values) {
    const missingFields = ['code', 'name'].filter((field) => !values[field]);
    if (missingFields.length) {
      throw new ValidationError('Station code and name are required', { missingFields });
    }
  }

  #normalizeCode(code) {
    if (typeof code !== 'string' || !code.trim()) {
      throw new ValidationError('A station code is required', { field: 'code' });
    }
    return code.trim().toUpperCase();
  }
}

module.exports = StationService;
