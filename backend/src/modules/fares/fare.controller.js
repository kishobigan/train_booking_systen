'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
class FareController {
  constructor(fareCalculationService) {
    this.fareCalculationService = fareCalculationService;
  }
  quoteFare = asyncHandler(async (req, res) => {
    const result = await this.fareCalculationService.quoteFare(req.body);
    res.status(200).json(apiResponse.success(result));
  });
}
module.exports = FareController;
