'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  'major model associations query the migrated test database',
  { skip: !testDatabaseUrl },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NODE_ENV = 'test';

    const sequelize = require('../../src/database/sequelize');
    const {
      User,
      Station,
      Route,
      RouteStation,
      Train,
      Coach,
      Seat,
      Journey,
      JourneyStation,
      JourneyCoach,
      JourneySeat,
      Booking,
      BookingPassenger,
      BookingSeat,
    } = require('../../src/models');

    try {
      await sequelize.authenticate();
      await User.findOne();
      await Station.findAll({ limit: 1 });
      await Route.findOne({
        include: [
          {
            model: RouteStation,
            as: 'routeStations',
            include: [{ model: Station, as: 'station' }],
          },
        ],
      });
      await Train.findOne({
        include: [{ model: Coach, as: 'coaches', include: [{ model: Seat, as: 'seats' }] }],
      });
      await Journey.findOne({
        include: [
          { model: JourneyStation, as: 'journeyStations' },
          {
            model: JourneyCoach,
            as: 'journeyCoaches',
            include: [{ model: JourneySeat, as: 'journeySeats' }],
          },
        ],
      });
      await Booking.findOne({
        include: [
          { model: BookingPassenger, as: 'passengers' },
          { model: BookingSeat, as: 'bookingSeats', include: [{ model: Seat, as: 'seat' }] },
        ],
      });
      assert(true);
    } finally {
      await sequelize.close();
    }
  }
);
