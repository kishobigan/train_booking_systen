'use strict';

const repositories = require('./repositories');
const StationService = require('../modules/stations/station.service');
const RouteService = require('../modules/routes/route.service');
const TrainService = require('../modules/trains/train.service');
const CoachService = require('../modules/coaches/coach.service');
const SeatService = require('../modules/seats/seat.service');
const JourneyService = require('../modules/journeys/journey.service');
const FareRuleService = require('../modules/fares/fare-rule.service');
const FareRuleClassService = require('../modules/fares/fare-rule-class.service');
const PassengerFareRuleService = require('../modules/fares/passenger-fare-rule.service');
const FareCalculationService = require('../modules/fares/fare-calculation.service');
const BookingService = require('../modules/bookings/booking.service');

const fareCalculationService = new FareCalculationService({
  journeyRepository: repositories.journeyRepository,
  journeyStationRepository: repositories.journeyStationRepository,
  journeySeatRepository: repositories.journeySeatRepository,
  fareRuleRepository: repositories.fareRuleRepository,
  fareRuleClassRepository: repositories.fareRuleClassRepository,
  passengerFareRuleRepository: repositories.passengerFareRuleRepository,
});

module.exports = {
  fareCalculationService,
  fareRuleService: new FareRuleService(repositories.fareRuleRepository),
  fareRuleClassService: new FareRuleClassService(repositories.fareRuleClassRepository),
  passengerFareRuleService: new PassengerFareRuleService(repositories.passengerFareRuleRepository),
  bookingService: new BookingService({
    bookingRepository: repositories.bookingRepository,
    bookingPassengerRepository: repositories.bookingPassengerRepository,
    bookingSeatRepository: repositories.bookingSeatRepository,
    activeSeatAllocationRepository: repositories.activeSeatAllocationRepository,
    fareCalculationService,
  }),
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
