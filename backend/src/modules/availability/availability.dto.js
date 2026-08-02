'use strict';
function availabilityDto(input = {}) {
  const boolean = (value) => (value === undefined ? undefined : value === true || value === 'true');
  return {
    journeyId: input.journeyId,
    originJourneyStationId: input.originJourneyStationId,
    destinationJourneyStationId: input.destinationJourneyStationId,
    coachClass: input.coachClass,
    coachNumber: input.coachNumber,
    seatType: input.seatType,
    isWindow: boolean(input.isWindow),
    isAisle: boolean(input.isAisle),
    isAccessible: boolean(input.isAccessible),
    page: input.page === undefined ? 1 : Number(input.page),
    limit: input.limit === undefined ? 50 : Number(input.limit),
  };
}
module.exports = { availabilityDto };
