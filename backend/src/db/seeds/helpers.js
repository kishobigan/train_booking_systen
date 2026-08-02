'use strict';

const MAJOR_STATIONS = new Set([
  'FOT',
  'RGM',
  'GPH',
  'PLG',
  'RBK',
  'PDA',
  'GPL',
  'NVP',
  'HTN',
  'NAN',
  'HPT',
  'BND',
  'ELL',
  'BAD',
]);

const normalizeName = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
const roundDistance = (value) => Number(value.toFixed(2));

function buildTimetable(stations, speedKmh = 42) {
  let priorDwell = 0;
  return stations.map((station, index) => {
    const isFirst = index === 0;
    const isLast = index === stations.length - 1;
    const travelMinutes = Math.round((station.distanceKm / speedKmh) * 60);
    const arrivalOffsetMinutes = isFirst ? null : travelMinutes + priorDwell;
    const stopDurationMinutes = isFirst || isLast ? 0 : MAJOR_STATIONS.has(station.code) ? 5 : 2;
    const departureOffsetMinutes = isLast
      ? null
      : isFirst
        ? 0
        : arrivalOffsetMinutes + stopDurationMinutes;
    priorDwell += stopDurationMinutes;
    return { ...station, arrivalOffsetMinutes, departureOffsetMinutes, stopDurationMinutes };
  });
}

function generateSeats(coach) {
  if (coach.reservationType !== 'RESERVED') return [];
  const seats = [];
  for (let row = 1; row <= coach.rows; row += 1) {
    for (let column = 1; column <= coach.columns; column += 1) {
      const letter = String.fromCharCode(64 + column);
      seats.push({
        seatNumber: `${row}${letter}`,
        rowNumber: row,
        columnNumber: column,
        seatType: column === 1 || column === coach.columns ? 'WINDOW' : 'AISLE',
        isWindow: column === 1 || column === coach.columns,
        isAisle: (column > 1 && column < coach.columns) || (coach.columns === 3 && column === 2),
        isAccessible: row === 1 && column === 1,
        isActive: true,
      });
    }
  }
  return seats.slice(0, coach.totalSeats);
}

function dateInTimeZone(now, timeZone, daysAhead) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const date = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + daysAhead)
  );
  return date.toISOString().slice(0, 10);
}

function zonedDateTime(date, time, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = desired;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
        .formatToParts(new Date(result))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );
    const represented = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour % 24,
      +parts.minute,
      +parts.second
    );
    result -= represented - desired;
  }
  return new Date(result);
}

function assertSeedData(stations, coaches) {
  if (stations.length !== 79 || stations.some((station, i) => station.sequenceNumber !== i))
    throw new Error('Station sequence must contain exactly 79 continuous entries');
  if (stations.some((station, i) => i && station.distanceKm <= stations[i - 1].distanceKm))
    throw new Error('Station distances must be strictly increasing');
  if (stations[0].code !== 'FOT' || stations.at(-1).code !== 'BAD')
    throw new Error('Route endpoints are invalid');
  if (coaches.length !== 8 || coaches.some((coach, i) => coach.positionNumber !== i + 1))
    throw new Error('Coach positions are invalid');
  for (const coach of coaches) {
    const seatNumbers = generateSeats(coach).map((seat) => seat.seatNumber);
    if (new Set(seatNumbers).size !== seatNumbers.length)
      throw new Error(`Duplicate seats in coach ${coach.coachNumber}`);
  }
}

module.exports = {
  assertSeedData,
  buildTimetable,
  dateInTimeZone,
  generateSeats,
  normalizeName,
  roundDistance,
  zonedDateTime,
};
