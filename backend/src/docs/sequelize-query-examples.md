# Sequelize association examples

Models and aliases are exported from `src/models`.

```js
const { Route, RouteStation, Station } = require('../models');

const route = await Route.findByPk(routeId, {
  include: [
    { model: RouteStation, as: 'routeStations', include: [{ model: Station, as: 'station' }] },
    { model: Station, as: 'startStation' },
    { model: Station, as: 'endStation' },
  ],
  order: [[{ model: RouteStation, as: 'routeStations' }, 'sequenceNumber', 'ASC']],
});
```

```js
const { Train, Coach, Seat } = require('../models');

const train = await Train.findByPk(trainId, {
  include: [{ model: Coach, as: 'coaches', include: [{ model: Seat, as: 'seats' }] }],
  order: [[{ model: Coach, as: 'coaches' }, 'positionNumber', 'ASC']],
});
```

```js
const { Journey, JourneyStation, JourneyCoach, JourneySeat } = require('../models');

const journey = await Journey.findByPk(journeyId, {
  include: [
    { model: JourneyStation, as: 'journeyStations' },
    {
      model: JourneyCoach,
      as: 'journeyCoaches',
      include: [{ model: JourneySeat, as: 'journeySeats' }],
    },
  ],
});
```

```js
const {
  Booking,
  User,
  Journey,
  JourneyStation,
  BookingPassenger,
  BookingSeat,
  Seat,
  Payment,
} = require('../models');

const booking = await Booking.findByPk(bookingId, {
  include: [
    { model: User, as: 'user' },
    { model: Journey, as: 'journey' },
    { model: JourneyStation, as: 'originJourneyStation' },
    { model: JourneyStation, as: 'destinationJourneyStation' },
    { model: BookingPassenger, as: 'passengers' },
    { model: BookingSeat, as: 'bookingSeats', include: [{ model: Seat, as: 'seat' }] },
    { model: Payment, as: 'payments' },
  ],
});
```
