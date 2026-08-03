'use strict';
const express = require('express');
const authorize = require('../common/middleware/authorize.middleware');
const requirePasswordChanged = require('../common/middleware/require-password-change.middleware');
const asyncHandler = require('../common/utils/async-handler');
const apiResponse = require('../common/utils/api-response');
const ValidationError = require('../common/errors/ValidationError');
const ManagementService = require('../modules/management/management.service');
const scopeMiddleware = require('../common/middleware/authorize-station-scope.middleware');
const { JourneyStation } = require('../models');
const { validateReportQuery } = require('../modules/reports/report.validator');
const clean = (row) => row?.toJSON?.() || row;
module.exports = (services) => {
  const router = express.Router();
  const management = new ManagementService();
  const scope = services.stationScopeAuthorizationService;
  const guard = scopeMiddleware(scope);
  router.use(requirePasswordChanged, authorize('STAFF'));
  const scopedList = (resource) =>
    asyncHandler(async (req, res) => {
      const ids = await scope.getAccessibleStationIds(req.user);
      if (req.query.stationId && !ids.includes(req.query.stationId))
        await scope.assertStationAccess(req.user, req.query.stationId);
      res.json(
        apiResponse.success(
          await management.list(resource, { ...req.query, accessibleStationIds: ids })
        )
      );
    });
  router.get('/stations', scopedList('stations'));
  router.get(
    '/stations/:stationId',
    guard.authorizeStationParam(),
    asyncHandler(async (req, res) =>
      res.json(
        apiResponse.success(clean(await services.stationService.getStation(req.params.stationId)))
      )
    )
  );
  router.patch(
    '/stations/:stationId',
    guard.authorizeStationParam(),
    asyncHandler(async (req, res) => {
      const forbidden = Object.keys(req.body).filter((key) => !['platformCount'].includes(key));
      if (forbidden.length)
        throw new ValidationError('Staff may update only approved operational station fields', {
          forbiddenFields: forbidden,
        });
      const station = await services.stationService.updateStation(req.params.stationId, req.body);
      await services.auditService.record({
        userId: req.user.id,
        action: 'STAFF_UPDATED_STATION_OPERATIONAL_DATA',
        entityType: 'Station',
        entityId: station.id,
        newValues: req.body,
      });
      res.json(apiResponse.success(clean(station)));
    })
  );
  router.get('/journeys', scopedList('journeys'));
  router.get(
    '/journeys/:journeyId',
    guard.authorizeJourneyStationScope(),
    asyncHandler(async (req, res) =>
      res.json(
        apiResponse.success(
          clean(await services.journeyService.getJourneySnapshot(req.params.journeyId))
        )
      )
    )
  );
  router.get(
    '/journeys/:journeyId/seat-map',
    guard.authorizeJourneyStationScope(),
    asyncHandler(async (req, res) =>
      res.json(apiResponse.success(await services.seatMapService.getSeatMapSnapshot({ ...req.query, journeyId: req.params.journeyId })))
    )
  );
  router.get('/bookings', scopedList('bookings'));
  router.get(
    '/bookings/:bookingId',
    guard.authorizeBookingStationScope(),
    asyncHandler(async (req, res) =>
      res.json(apiResponse.success(await management.detail('bookings', req.params.bookingId)))
    )
  );
  router.post(
    '/bookings/hold',
    asyncHandler(async (req, res, next) => {
      const stationRows = await JourneyStation.findAll({
        where: { id: [req.body.originJourneyStationId, req.body.destinationJourneyStationId] },
        attributes: ['stationId'],
      });
      const assigned = await scope.getAccessibleStationIds(req.user);
      if (!stationRows.some((row) => assigned.includes(row.stationId)))
        return next(
          new ValidationError('Assisted booking must originate or terminate at an assigned station')
        );
      return services.bookingService
        .createBookingHold({ ...req.body, userId: null, createdByUserId: req.user.id })
        .then((result) => res.status(201).json(apiResponse.success(result)))
        .catch(next);
    })
  );
  router.get(
    '/reports/occupancy',
    asyncHandler(async (req, res) =>
      res.json(apiResponse.success(await services.reportService.getOccupancyReport({ actor: req.user, ...validateReportQuery(req.query) })))
    )
  );
  return router;
};
