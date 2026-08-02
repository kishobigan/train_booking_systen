'use strict';

const repositoryClasses = {
  userRepository: require('../modules/users/user.repository'),
  stationRepository: require('../modules/stations/station.repository'),
  routeRepository: require('../modules/routes/route.repository'),
  routeStationRepository: require('../modules/routes/route-station.repository'),
  trainRepository: require('../modules/trains/train.repository'),
  coachRepository: require('../modules/coaches/coach.repository'),
  seatRepository: require('../modules/seats/seat.repository'),
  journeyRepository: require('../modules/journeys/journey.repository'),
  journeyStationRepository: require('../modules/journeys/journey-station.repository'),
  journeyCoachRepository: require('../modules/journeys/journey-coach.repository'),
  journeySeatRepository: require('../modules/journeys/journey-seat.repository'),
  fareRuleRepository: require('../modules/fares/fare-rule.repository'),
  bookingRepository: require('../modules/bookings/booking.repository'),
  bookingPassengerRepository: require('../modules/bookings/booking-passenger.repository'),
  bookingSeatRepository: require('../modules/bookings/booking-seat.repository'),
  activeSeatAllocationRepository: require('../modules/bookings/allocation.repository'),
  paymentRepository: require('../modules/payments/payment.repository'),
  refundRepository: require('../modules/refunds/refund.repository'),
  waitlistRepository: require('../modules/waitlist/waitlist.repository'),
  notificationRepository: require('../modules/notifications/notification.repository'),
  auditRepository: require('../modules/audit/audit.repository'),
};

module.exports = Object.fromEntries(
  Object.entries(repositoryClasses).map(([name, Repository]) => [name, new Repository()])
);
