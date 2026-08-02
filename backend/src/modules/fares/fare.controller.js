'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { fareQuoteDto } = require('./fare.dto');
const { validateFareQuoteInput } = require('./fare.validator');
const fareConfig = require('../../config/fare');
class FareController {
  constructor(fareCalculationService) {
    this.fareCalculationService = fareCalculationService;
  }
  quoteFare = asyncHandler(async (req, res) => {
    const result = await this.fareCalculationService.quoteFare(
      validateFareQuoteInput(fareQuoteDto(req.body), fareConfig.maximumPassengersPerBooking)
    );
    res.status(200).json(apiResponse.success(result));
  });
}
module.exports = FareController;
