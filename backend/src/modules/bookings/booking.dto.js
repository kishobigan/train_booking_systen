'use strict';
function bookingHoldDto(input = {}) {
  return {
    journeyId: input.journeyId,
    originJourneyStationId: input.originJourneyStationId,
    destinationJourneyStationId: input.destinationJourneyStationId,
    passengers: Array.isArray(input.passengers)
      ? input.passengers.map((passenger) => ({
          fullName: passenger.fullName,
          passengerType: passenger.passengerType,
          identityType: passenger.identityType,
          identityNumber: passenger.identityNumber,
          dateOfBirth: passenger.dateOfBirth,
          journeySeatId: passenger.journeySeatId,
        }))
      : input.passengers,
    contact: input.contact && {
      fullName: input.contact.fullName,
      email: input.contact.email,
      phone: input.contact.phone,
    },
    idempotencyKey: input.idempotencyKey,
  };
}
module.exports = { bookingHoldDto };
