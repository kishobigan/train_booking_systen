'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const validator = require('./journey.validator');
class JourneyController {
  constructor(journeyService) {
    this.service = journeyService;
  }
  search = asyncHandler(async (req, res) => {
    const result = await this.service.searchPublicJourneys(validator.search(req.query));
    res.json({
      ...apiResponse.success({ search: result.search, items: result.items }),
      pagination: result.pagination,
    });
  });
  details = asyncHandler(async (req, res) => {
    const journey = await this.service.getPublicJourneyDetails(validator.id(req.params.journeyId));
    res.json(
      apiResponse.success({
        id: journey.id,
        serviceNumber: journey.serviceNumber,
        journeyDate: journey.journeyDate,
        status: journey.status,
        train: journey.train && {
          id: journey.train.id,
          trainNumber: journey.train.trainNumber,
          name: journey.train.name,
        },
        route: journey.route && {
          id: journey.route.id,
          code: journey.route.code,
          name: journey.route.name,
        },
        scheduledDepartureAt: journey.scheduledDepartureAt,
        scheduledArrivalAt: journey.scheduledArrivalAt,
        bookingOpensAt: journey.bookingOpensAt,
        bookingClosesAt: journey.bookingClosesAt,
        stations: (journey.journeyStations || []).map((item) => ({
          journeyStationId: item.id,
          station: item.station && {
            id: item.station.id,
            code: item.station.code,
            name: item.station.name,
          },
          sequenceNumber: item.sequenceNumber,
          distanceFromStartKm: item.distanceFromStartKm,
          scheduledArrivalAt: item.scheduledArrivalAt,
          scheduledDepartureAt: item.scheduledDepartureAt,
          actualArrivalAt: item.actualArrivalAt,
          actualDepartureAt: item.actualDepartureAt,
          platformNumber: item.platformNumber,
          canBoard: item.canBoard,
          canAlight: item.canAlight,
        })),
        coaches: (journey.journeyCoaches || []).map((item) => ({
          journeyCoachId: item.id,
          coachNumber: item.coachNumberSnapshot,
          coachClass: item.coachClassSnapshot,
          reservationType: item.reservationTypeSnapshot,
          positionNumber: item.positionNumber,
          isAvailable: item.isAvailable,
          totalSeats: item.journeySeats?.length || 0,
        })),
      })
    );
  });
}
module.exports = JourneyController;
