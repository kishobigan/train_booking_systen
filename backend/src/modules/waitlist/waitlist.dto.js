'use strict';

function joinWaitlistDto(body = {}) {
  return {
    journeyId: body.journeyId,
    originJourneyStationId: body.originJourneyStationId,
    destinationJourneyStationId: body.destinationJourneyStationId,
    requestedCoachClass: body.requestedCoachClass,
    passengerCount: Number(body.passengerCount),
    contact: body.contact,
  };
}

function acceptOfferDto(body = {}) {
  return { passengers: body.passengers, contact: body.contact };
}

module.exports = { joinWaitlistDto, acceptOfferDto };
