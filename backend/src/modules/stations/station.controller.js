'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const {
  validateListQuery,
  validateSearchQuery,
  validateStationId,
} = require('./station.validator');
const stationDto = (station) => ({
  id: station.id,
  code: station.code,
  name: station.name,
  localName: station.localName,
  city: station.city,
  district: station.district,
  latitude: station.latitude,
  longitude: station.longitude,
  platformCount: station.platformCount,
  isActive: station.isActive,
});
class StationController {
  constructor(stationService) {
    this.service = stationService;
  }
  list = asyncHandler(async (req, res) => {
    const result = await this.service.getStations(validateListQuery(req.query));
    res.json({
      ...apiResponse.success(result.items.map(stationDto)),
      pagination: result.pagination,
    });
  });
  details = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        stationDto(await this.service.getStation(validateStationId(req.params.stationId)))
      )
    )
  );
  search = asyncHandler(async (req, res) => {
    const input = validateSearchQuery(req.query);
    const items = await this.service.searchStations(input.q, {
      limit: input.limit,
      isActive: input.isActive,
    });
    res.json(apiResponse.success({ query: input.q, items: items.map(stationDto) }));
  });
}
module.exports = StationController;
