'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { availabilityDto } = require('./availability.dto');
const { validateAvailabilityInput } = require('./availability.validator');
class AvailabilityController {
  constructor(seatAvailabilityService) {
    this.service = seatAvailabilityService;
  }
  getAvailableSeats = asyncHandler(async (req, res) => {
    const input = validateAvailabilityInput(
      availabilityDto({ journeyId: req.params.journeyId, ...req.query })
    );
    res.status(200).json(apiResponse.success(await this.service.getAvailableSeats(input)));
  });
  getSeatAvailability = this.getAvailableSeats;
  getSummary = asyncHandler(async (req, res) => {
    const input = validateAvailabilityInput(
      availabilityDto({ journeyId: req.params.journeyId, ...req.query })
    );
    res
      .status(200)
      .json(apiResponse.success(await this.service.getJourneyAvailabilitySummary(input)));
  });
  getAvailabilitySummary = this.getSummary;
  getCoachAvailability = asyncHandler(async (req, res) => {
    const input = validateAvailabilityInput(
      availabilityDto({ journeyId: req.params.journeyId, ...req.query })
    );
    res
      .status(200)
      .json(apiResponse.success(await this.service.getCoachAvailabilityResponse(input)));
  });
  getTimeline = asyncHandler(async (req, res) => {
    res.status(200).json(
      apiResponse.success(
        await this.service.getSeatOccupancyTimeline({
          journeyId: req.params.journeyId,
          journeySeatId: req.params.journeySeatId,
        })
      )
    );
  });
}
module.exports = AvailabilityController;
