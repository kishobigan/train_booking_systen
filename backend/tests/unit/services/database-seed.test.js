'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { coaches, stations } = require('../../../src/db/seeds/data');
const {
  assertSeedData,
  buildTimetable,
  generateSeats,
  zonedDateTime,
} = require('../../../src/db/seeds/helpers');

test('seed data has continuous stations, ordered distances, and valid coaches', () => {
  assert.doesNotThrow(() => assertSeedData(stations, coaches));
  assert.equal(stations.length, 79);
  assert.equal(stations[0].code, 'FOT');
  assert.equal(stations.at(-1).code, 'BAD');
});

test('reserved seat generation creates 120 unique physical seats', () => {
  const generated = coaches.flatMap(generateSeats);
  assert.equal(generated.length, 120);
  for (const coach of coaches) {
    const seats = generateSeats(coach);
    assert.equal(seats.length, coach.totalSeats);
    assert.equal(new Set(seats.map((seat) => seat.seatNumber)).size, seats.length);
  }
});

test('timetable offsets increase and preserve terminal semantics', () => {
  const timetable = buildTimetable(stations);
  assert.equal(timetable[0].arrivalOffsetMinutes, null);
  assert.equal(timetable[0].departureOffsetMinutes, 0);
  assert.equal(timetable.at(-1).departureOffsetMinutes, null);
  assert.ok(timetable.at(-1).arrivalOffsetMinutes > timetable.at(-2).arrivalOffsetMinutes);
});

test('Asia/Colombo 05:55 is represented as the correct UTC instant', () => {
  assert.equal(
    zonedDateTime('2026-08-09', '05:55', 'Asia/Colombo').toISOString(),
    '2026-08-09T00:25:00.000Z'
  );
});
