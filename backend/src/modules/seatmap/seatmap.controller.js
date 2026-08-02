'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
class SeatMapController {
  constructor(seatMapService) {
    this.service = seatMapService;
  }
  get = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.service.getSeatMap({ journeyId: req.params.journeyId, ...req.query })
      )
    )
  );
}
module.exports = SeatMapController;
