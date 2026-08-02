'use strict';

const repositories = require('./repositories');
const StationService = require('../modules/stations/station.service');
const RouteService = require('../modules/routes/route.service');
const TrainService = require('../modules/trains/train.service');
const CoachService = require('../modules/coaches/coach.service');

module.exports = {
  stationService: new StationService(repositories.stationRepository),
  routeService: new RouteService({
    routeRepository: repositories.routeRepository,
    routeStationRepository: repositories.routeStationRepository,
    stationRepository: repositories.stationRepository,
  }),
  trainService: new TrainService(repositories.trainRepository),
  coachService: new CoachService({
    coachRepository: repositories.coachRepository,
    seatRepository: repositories.seatRepository,
    trainRepository: repositories.trainRepository,
  }),
};
