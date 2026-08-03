'use strict';

const express = require('express');
const authorize = require('../common/middleware/authorize.middleware');
const requirePasswordChanged = require('../common/middleware/require-password-change.middleware');
const asyncHandler = require('../common/utils/async-handler');
const apiResponse = require('../common/utils/api-response');
const ValidationError = require('../common/errors/ValidationError');
const repositories = require('../container/repositories');

const clean = (record) => record?.toJSON?.() || record;

module.exports = function createResourceManagementRouter(services) {
  const router = express.Router();
  router.use(requirePasswordChanged, authorize('SUPER_ADMIN'));

  router.get('/stations', asyncHandler(async (req, res) => {
    const result = await services.stationService.getStations({ ...req.query, limit: req.query.limit || 100 });
    res.json(apiResponse.success(result));
  }));
  router.post('/stations', asyncHandler(async (req, res) => {
    const station = await services.stationService.createStation(req.body);
    await services.auditService.record({ userId: req.user.id, action: 'STATION_CREATED', entityType: 'Station', entityId: station.id });
    res.status(201).json(apiResponse.success(clean(station)));
  }));
  router.patch('/stations/:stationId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.stationService.updateStation(req.params.stationId, req.body))));
  }));

  router.get('/trains', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await services.trainService.listTrains({ ...req.query, pageSize: req.query.limit || 100 })));
  }));
  router.get('/trains/:trainId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.trainService.getTrainConfiguration(req.params.trainId))));
  }));
  router.post('/trains', asyncHandler(async (req, res) => {
    const train = await services.trainService.createTrain(req.body);
    await services.auditService.record({ userId: req.user.id, action: 'TRAIN_CREATED', entityType: 'Train', entityId: train.id });
    res.status(201).json(apiResponse.success(clean(train)));
  }));
  router.post('/trains/:trainId/coaches', asyncHandler(async (req, res) => {
    const coach = await services.coachService.createCoach({ ...req.body, trainId: req.params.trainId });
    await services.auditService.record({ userId: req.user.id, action: 'COACH_CREATED', entityType: 'Coach', entityId: coach.id });
    res.status(201).json(apiResponse.success(clean(coach)));
  }));
  router.post('/coaches/:coachId/seats/generate', asyncHandler(async (req, res) => {
    const seats = await services.coachService.generateSeats(req.params.coachId, req.body);
    await services.auditService.record({ userId: req.user.id, action: 'SEATS_GENERATED', entityType: 'Coach', entityId: req.params.coachId, newValues: { count: seats.length } });
    res.status(201).json(apiResponse.success(seats.map(clean)));
  }));

  router.get('/journeys', asyncHandler(async (req, res) => {
    res.json(apiResponse.success((await services.journeyService.searchJourneys(req.query)).map(clean)));
  }));
  router.post('/journeys', asyncHandler(async (req, res) => {
    const journey = await services.journeyService.createJourney(req.body);
    await services.auditService.record({ userId: req.user.id, action: 'JOURNEY_CREATED', entityType: 'Journey', entityId: journey.id });
    res.status(201).json(apiResponse.success(clean(journey)));
  }));
  router.post('/journeys/:journeyId/snapshots', asyncHandler(async (req, res) => {
    const result = await services.journeyService.generateSnapshots(req.params.journeyId, req.body || {});
    await services.auditService.record({ userId: req.user.id, action: 'JOURNEY_SNAPSHOTS_GENERATED', entityType: 'Journey', entityId: req.params.journeyId });
    res.status(201).json(apiResponse.success({ journey: clean(result.journey), stationCount: result.stations.length, coachCount: result.coaches.length, seatCount: result.seats.length }));
  }));

  router.get('/fare-rules', asyncHandler(async (req, res) => {
    if (!req.query.routeId) throw new ValidationError('routeId is required');
    res.json(apiResponse.success((await repositories.fareRuleRepository.findByRoute(req.query.routeId)).map(clean)));
  }));
  router.post('/fare-rules', asyncHandler(async (req, res) => {
    const { classes = [], passengerRules = [], ...values } = req.body;
    const result = await services.transactionManager.execute(async (transaction) => {
      const fare = await repositories.fareRuleRepository.create(values, { transaction });
      for (const item of classes) await repositories.fareRuleClassRepository.create({ ...item, fareRuleId: fare.id }, { transaction });
      for (const item of passengerRules) {
        const existing = await repositories.passengerFareRuleRepository.findOne({ passengerType: item.passengerType }, { transaction });
        if (existing) await existing.update(item, { transaction });
        else await repositories.passengerFareRuleRepository.create(item, { transaction });
      }
      await services.auditService.record({ userId: req.user.id, action: 'FARE_RULE_CREATED', entityType: 'FareRule', entityId: fare.id }, { transaction });
      return fare;
    });
    res.status(201).json(apiResponse.success(clean(result)));
  }));

  return router;
};
