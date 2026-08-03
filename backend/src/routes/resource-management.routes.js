'use strict';

const express = require('express');
const authorize = require('../common/middleware/authorize.middleware');
const requirePasswordChanged = require('../common/middleware/require-password-change.middleware');
const asyncHandler = require('../common/utils/async-handler');
const apiResponse = require('../common/utils/api-response');
const ValidationError = require('../common/errors/ValidationError');
const repositories = require('../container/repositories');
const ManagementService = require('../modules/management/management.service');

const clean = (record) => record?.toJSON?.() || record;

module.exports = function createResourceManagementRouter(services) {
  const router = express.Router();
  const management = new ManagementService();
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
  router.get('/stations/:stationId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.stationService.getStation(req.params.stationId))));
  }));
  router.patch('/stations/:stationId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.stationService.updateStation(req.params.stationId, req.body))));
  }));
  for (const [path, isActive, action] of [['activate', true, 'STATION_ACTIVATED'], ['deactivate', false, 'STATION_DEACTIVATED']]) {
    router.post(`/stations/:stationId/${path}`, asyncHandler(async (req, res) => {
      const station = await services.stationService.updateStation(req.params.stationId, { isActive });
      await services.auditService.record({ userId: req.user.id, action, entityType: 'Station', entityId: station.id });
      res.json(apiResponse.success(clean(station)));
    }));
  }

  router.get('/routes', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await services.routeService.getRoutes(req.query)));
  }));
  router.get('/routes/:routeId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.routeService.getRouteWithStations(req.params.routeId))));
  }));
  router.post('/routes', asyncHandler(async (req, res) => {
    const input = { ...req.body, actor: req.user };
    const route = Array.isArray(req.body.stations)
      ? await services.routeService.createRouteWithStations(input)
      : await services.routeService.createRoute(req.body);
    await services.auditService.record({ userId: req.user.id, action: 'ROUTE_CREATED', entityType: 'Route', entityId: route.id });
    res.status(201).json(apiResponse.success(clean(route)));
  }));
  router.patch('/routes/:routeId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.routeService.updateRoute(req.params.routeId, req.body))));
  }));
  router.post('/routes/:routeId/stations', asyncHandler(async (req, res) => {
    res.status(201).json(apiResponse.success(clean(await services.routeService.addStation(req.params.routeId, req.body))));
  }));
  router.patch('/routes/:routeId/stations/reorder', asyncHandler(async (req, res) => {
    res.json(apiResponse.success((await services.routeService.reorderRouteStations(req.params.routeId, req.body.stations || [])).map(clean)));
  }));
  router.delete('/routes/:routeId/stations/:routeStationId', asyncHandler(async (req, res) => {
    await services.routeService.removeStation(req.params.routeId, req.params.routeStationId);
    res.status(204).end();
  }));
  for (const [path, isActive] of [['activate', true], ['deactivate', false]]) {
    router.post(`/routes/:routeId/${path}`, asyncHandler(async (req, res) => {
      res.json(apiResponse.success(clean(await services.routeService.updateRoute(req.params.routeId, { isActive }))));
    }));
  }

  router.get('/trains', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await management.list('trains', req.query)));
  }));
  router.get('/trains/:trainId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.trainService.getTrainConfiguration(req.params.trainId))));
  }));
  router.post('/trains', asyncHandler(async (req, res) => {
    const train = await services.trainService.createTrain(req.body);
    await services.auditService.record({ userId: req.user.id, action: 'TRAIN_CREATED', entityType: 'Train', entityId: train.id });
    res.status(201).json(apiResponse.success(clean(train)));
  }));
  router.patch('/trains/:trainId', asyncHandler(async (req, res) => {
    const train = await services.trainService.updateTrain(req.params.trainId, req.body);
    await services.auditService.record({ userId: req.user.id, action: 'TRAIN_UPDATED', entityType: 'Train', entityId: train.id });
    res.json(apiResponse.success(clean(train)));
  }));
  for (const [path, isActive, action] of [['activate', true, 'TRAIN_ACTIVATED'], ['deactivate', false, 'TRAIN_DEACTIVATED']]) {
    router.post(`/trains/:trainId/${path}`, asyncHandler(async (req, res) => {
      const train = await services.trainService.updateTrain(req.params.trainId, { isActive });
      await services.auditService.record({ userId: req.user.id, action, entityType: 'Train', entityId: train.id });
      res.json(apiResponse.success(clean(train)));
    }));
  }
  router.get('/trains/:trainId/coaches', asyncHandler(async (req, res) => {
    const train = await services.trainService.getTrainConfiguration(req.params.trainId);
    res.json(apiResponse.success((train.coaches || []).map(clean)));
  }));
  router.get('/trains/:trainId/seats', asyncHandler(async (req, res) => {
    const train = await services.trainService.getTrainConfiguration(req.params.trainId);
    res.json(apiResponse.success((train.coaches || []).flatMap((coach) => (coach.seats || []).map(clean))));
  }));
  router.post('/trains/:trainId/coaches', asyncHandler(async (req, res) => {
    const coach = await services.coachService.createCoach({ ...req.body, trainId: req.params.trainId });
    await services.auditService.record({ userId: req.user.id, action: 'COACH_CREATED', entityType: 'Coach', entityId: coach.id });
    res.status(201).json(apiResponse.success(clean(coach)));
  }));
  router.patch('/trains/:trainId/coaches/:coachId', asyncHandler(async (req, res) => {
    const coach = await services.coachService.updateCoach(req.params.coachId, req.body);
    res.json(apiResponse.success(clean(coach)));
  }));
  router.patch('/trains/:trainId/seats/:seatId', asyncHandler(async (req, res) => {
    const seat = await services.seatService.updateSeat(req.params.seatId, req.body);
    res.json(apiResponse.success(clean(seat)));
  }));
  router.post('/trains/:trainId/coaches/:coachId/seats/generate', asyncHandler(async (req, res) => {
    const seats = await services.coachService.generateSeats(req.params.coachId, req.body);
    res.status(201).json(apiResponse.success(seats.map(clean)));
  }));
  router.post('/coaches/:coachId/seats/generate', asyncHandler(async (req, res) => {
    const seats = await services.coachService.generateSeats(req.params.coachId, req.body);
    await services.auditService.record({ userId: req.user.id, action: 'SEATS_GENERATED', entityType: 'Coach', entityId: req.params.coachId, newValues: { count: seats.length } });
    res.status(201).json(apiResponse.success(seats.map(clean)));
  }));

  router.get('/journeys', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await management.list('journeys', req.query)));
  }));
  router.get('/journeys/:journeyId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.journeyService.getJourneySnapshot(req.params.journeyId))));
  }));
  router.patch('/journeys/:journeyId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.journeyService.updateJourney(req.params.journeyId, req.body))));
  }));
  router.post('/journeys/:journeyId/delay', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.journeyService.delayJourney(req.params.journeyId, Number(req.body.delayMinutes), { reason: req.body.reason }))));
  }));
  router.post('/journeys/:journeyId/cancel', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(clean(await services.journeyService.cancelJourney(req.params.journeyId))));
  }));

  for (const resource of ['bookings', 'payments', 'waitlist', 'users']) {
    router.get(`/${resource}`, asyncHandler(async (req, res) => {
      res.json(apiResponse.success(await management.list(resource, req.query)));
    }));
    router.get(`/${resource}/:${resource === 'waitlist' ? 'waitlistEntryId' : resource.slice(0, -1) + 'Id'}`, asyncHandler(async (req, res) => {
      const id = Object.values(req.params)[0];
      res.json(apiResponse.success(await management.detail(resource, id)));
    }));
  }
  router.get('/audit-logs', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await management.list('auditLogs', req.query)));
  }));
  router.get('/audit-logs/:auditLogId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await management.detail('auditLogs', req.params.auditLogId)));
  }));
  router.get('/admins/:adminId/trains', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await services.adminTrainAssignmentService.getAdminAssignedTrains({ actor: req.user, adminId: req.params.adminId })));
  }));
  router.post('/admins/:adminId/trains', asyncHandler(async (req, res) => {
    const assignments = await services.adminTrainAssignmentService.assignMultipleTrainsToAdmin({ actor: req.user, adminId: req.params.adminId, trainIds: req.body.trainIds });
    res.status(201).json(apiResponse.success(assignments));
  }));
  router.delete('/admins/:adminId/trains/:trainId', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await services.adminTrainAssignmentService.revokeTrainFromAdmin({ actor: req.user, adminId: req.params.adminId, trainId: req.params.trainId, reason: req.body?.reason })));
  }));
  router.get('/admins/:adminId/train-assignment-history', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await services.adminTrainAssignmentService.getAdminTrainAssignmentHistory({ actor: req.user, adminId: req.params.adminId })));
  }));
  router.get('/trains/:trainId/admins', asyncHandler(async (req, res) => {
    res.json(apiResponse.success(await services.adminTrainAssignmentService.getTrainAssignedAdmins({ actor: req.user, trainId: req.params.trainId })));
  }));
  router.get('/staff/:staffId/stations', asyncHandler(async(req,res)=>res.json(apiResponse.success(await services.staffStationAssignmentService.getStaffAssignedStations({actor:req.user,staffId:req.params.staffId})))));
  router.post('/staff/:staffId/stations', asyncHandler(async(req,res)=>res.status(201).json(apiResponse.success(await services.staffStationAssignmentService.assignMultipleStationsToStaff({actor:req.user,staffId:req.params.staffId,stationIds:req.body.stationIds})))));
  router.delete('/staff/:staffId/stations/:stationId', asyncHandler(async(req,res)=>res.json(apiResponse.success(await services.staffStationAssignmentService.revokeStationFromStaff({actor:req.user,staffId:req.params.staffId,stationId:req.params.stationId,reason:req.body?.reason})))));
  router.get('/staff/:staffId/station-assignment-history', asyncHandler(async(req,res)=>res.json(apiResponse.success(await services.staffStationAssignmentService.getStaffStationAssignmentHistory({actor:req.user,staffId:req.params.staffId})))));
  router.get('/stations/:stationId/staff', asyncHandler(async(req,res)=>res.json(apiResponse.success(await services.staffStationAssignmentService.getStationAssignedStaff({actor:req.user,stationId:req.params.stationId})))));
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
