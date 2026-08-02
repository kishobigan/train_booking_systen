'use strict';
const BaseRepository = require('../../common/repositories/BaseRepository');
const { RouteStation, Station } = require('../../models');
class RouteStationRepository extends BaseRepository {
  constructor() {
    super(RouteStation);
  }
  findByRoute(routeId, options = {}) {
    return this.findAll(
      { routeId },
      {
        ...options,
        include: options.include || [{ model: Station, as: 'station' }],
        order: options.order || [['sequenceNumber', 'ASC']],
      }
    );
  }
  findByRouteAndSequence(routeId, sequenceNumber, options = {}) {
    return this.findOne({ routeId, sequenceNumber }, options);
  }
  findByRouteAndStation(routeId, stationId, options = {}) {
    return this.findOne({ routeId, stationId }, options);
  }
}
module.exports = RouteStationRepository;
