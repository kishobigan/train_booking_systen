'use strict';

const repositories = require('./repositories');
const StationService = require('../modules/stations/station.service');
const RouteService = require('../modules/routes/route.service');
const TrainService = require('../modules/trains/train.service');
const CoachService = require('../modules/coaches/coach.service');
const SeatService = require('../modules/seats/seat.service');
const JourneyService = require('../modules/journeys/journey.service');

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
  seatService: new SeatService({
    seatRepository: repositories.seatRepository,
    coachRepository: repositories.coachRepository,
  }),
  journeyService: new JourneyService({
    journeyRepository: repositories.journeyRepository,
    journeyStationRepository: repositories.journeyStationRepository,
    journeyCoachRepository: repositories.journeyCoachRepository,
    journeySeatRepository: repositories.journeySeatRepository,
    routeRepository: repositories.routeRepository,
    trainRepository: repositories.trainRepository,
  }),
};
