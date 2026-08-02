'use strict';
const { Op } = require('sequelize');
const BaseRepository = require('../../common/repositories/BaseRepository');
const {
  Journey,
  JourneyStation,
  JourneyCoach,
  JourneySeat,
  Station,
  Coach,
  Route,
  Train,
} = require('../../models');
class JourneyRepository extends BaseRepository {
  constructor() {
    super(Journey);
  }
  findByServiceAndDate(serviceNumber, journeyDate, options = {}) {
    return this.findOne({ serviceNumber, journeyDate }, options);
  }
  search({ routeId, trainId, dateFrom, dateTo, statuses } = {}, options = {}) {
    const where = {};
    if (routeId) where.routeId = routeId;
    if (trainId) where.trainId = trainId;
    if (dateFrom || dateTo)
      where.journeyDate = {
        ...(dateFrom && { [Op.gte]: dateFrom }),
        ...(dateTo && { [Op.lte]: dateTo }),
      };
    if (statuses?.length) where.status = { [Op.in]: statuses };
    return this.findAll(where, {
      ...options,
      include: options.include || [
        { model: Route, as: 'route' },
        { model: Train, as: 'train' },
      ],
      order: options.order || [['scheduledDepartureAt', 'ASC']],
    });
  }
  findSnapshot(id, options = {}) {
    return this.model.findByPk(id, {
      ...options,
      include: [
        {
          model: JourneyStation,
          as: 'journeyStations',
          include: [{ model: Station, as: 'station' }],
        },
        {
          model: JourneyCoach,
          as: 'journeyCoaches',
          include: [
            { model: Coach, as: 'coach' },
            { model: JourneySeat, as: 'journeySeats' },
          ],
        },
      ],
      order: [
        [{ model: JourneyStation, as: 'journeyStations' }, 'sequenceNumber', 'ASC'],
        [{ model: JourneyCoach, as: 'journeyCoaches' }, 'positionNumber', 'ASC'],
      ],
    });
  }
}
module.exports = JourneyRepository;
