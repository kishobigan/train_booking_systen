'use strict';
const { Op } = require('sequelize');
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
  findAllPaginated(filters = {}, options = {}) {
    const where = {
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.startStationId && { startStationId: filters.startStationId }),
      ...(filters.endStationId && { endStationId: filters.endStationId }),
      ...(filters.q && {
        [Op.or]: [
          { code: { [Op.iLike]: `%${filters.q}%` } },
          { name: { [Op.iLike]: `%${filters.q}%` } },
        ],
      }),
    };
    return this.model.findAndCountAll({
      ...options,
      where,
      distinct: true,
      include: [
        { model: Station, as: 'startStation' },
        { model: Station, as: 'endStation' },
      ],
      attributes: {
        include: [
          [
            this.model.sequelize.literal(
              '(SELECT COUNT(*) FROM route_stations rs WHERE rs.route_id = "Route"."id")'
            ),
            'stationCount',
          ],
        ],
      },
    });
  }
}
module.exports = RouteRepository;
