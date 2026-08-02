'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { Route, RouteStation, Station } = require('../../models');
class RouteRepository extends BaseRepository {
  constructor() {
    super(Route);
  }
  findByCode(code, options = {}) {
    return this.findOne({ code }, options);
  }
  findWithStations(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        { model: RouteStation, as: 'routeStations', include: [{ model: Station, as: 'station' }] },
        { model: Station, as: 'startStation' },
        { model: Station, as: 'endStation' },
      ],
      order: [[{ model: RouteStation, as: 'routeStations' }, 'sequenceNumber', 'ASC']],
    });
  }
  findActive(options = {}) {
    return this.findAll({ isActive: true }, options);
  }
}
module.exports = RouteRepository;
