'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const validator = require('./route.validator');
const station = (item) => item && { id: item.id, code: item.code, name: item.name };
const summary = (route) => ({
  id: route.id,
  code: route.code,
  name: route.name,
  startStation: station(route.startStation),
  endStation: station(route.endStation),
  totalDistanceKm: route.totalDistanceKm,
  stationCount: Number(
    route.stationCount ?? route.get?.('stationCount') ?? route.routeStations?.length ?? 0
  ),
  isActive: route.isActive,
});
const details = (route) => ({
  ...summary(route),
  description: route.description,
  stations: (route.routeStations || []).map((item) => ({
    routeStationId: item.id,
    station: station(item.station),
    sequenceNumber: item.sequenceNumber,
    distanceFromStartKm: item.distanceFromStartKm,
    defaultArrivalOffsetMinutes: item.defaultArrivalOffsetMinutes,
    defaultDepartureOffsetMinutes: item.defaultDepartureOffsetMinutes,
    stopDurationMinutes: item.stopDurationMinutes,
    canBoard: item.canBoard,
    canAlight: item.canAlight,
  })),
});
class RouteController {
  constructor(routeService) {
    this.service = routeService;
  }
  create = asyncHandler(async (req, res) => {
    const route = await this.service.createRouteWithStations({
      actor: req.user,
      ...validator.create(req.body),
    });
    res.status(201).json(apiResponse.success(details(route)));
  });
  list = asyncHandler(async (req, res) => {
    const result = await this.service.getRoutes(validator.list(req.query));
    res.json({ ...apiResponse.success(result.items.map(summary)), pagination: result.pagination });
  });
  details = asyncHandler(async (req, res) => {
    const route = await this.service.getRouteWithStations(validator.id(req.params.routeId));
    res.json(apiResponse.success(details(route)));
  });
  update = asyncHandler(async (req, res) => {
    const route = await this.service.updateRoute(
      validator.id(req.params.routeId),
      validator.update(req.body)
    );
    res.json(apiResponse.success(summary(route)));
  });
  remove = asyncHandler(async (req, res) => {
    const result = await this.service.deactivateRoute(validator.id(req.params.routeId), req.user);
    res.json(apiResponse.success(result));
  });
  addStation = asyncHandler(async (req, res) => {
    const result = await this.service.addStation(
      validator.id(req.params.routeId),
      validator.routeStation(req.body)
    );
    res.status(201).json(apiResponse.success(result));
  });
  updateRouteStation = asyncHandler(async (req, res) => {
    const result = await this.service.updateRouteStation(
      validator.id(req.params.routeId),
      validator.id(req.params.routeStationId, 'routeStationId'),
      validator.routeStation(req.body)
    );
    res.json(apiResponse.success(result));
  });
  removeStation = asyncHandler(async (req, res) => {
    await this.service.removeStation(
      validator.id(req.params.routeId),
      validator.id(req.params.routeStationId, 'routeStationId')
    );
    res.status(204).send();
  });
  reorderStations = asyncHandler(async (req, res) => {
    const result = await this.service.reorderRouteStations(
      validator.id(req.params.routeId),
      validator.reorder(req.body)
    );
    res.json(apiResponse.success(result));
  });
  cloneReverse = asyncHandler(async (req, res) => {
    const route = await this.service.cloneReverseRoute(
      validator.id(req.params.routeId),
      req.body || {},
    );
    res.status(201).json(apiResponse.success(details(route)));
  });
}
module.exports = RouteController;
