'use strict';

const express = require('express');
const sequelize = require('../database/sequelize');
const services = require('../container/services');
const createFareRouter = require('../modules/fares/fare.routes');
const createPublicRouter = require('./public.routes');
const createPassengerRouter = require('./passenger.routes');
const createAdminRouter = require('./admin.routes');
const createAuthRouter = require('../modules/auth/auth.routes');
const authenticateFactory = require('../common/middleware/authenticate.middleware');
const { createSuperAdminRouter, createAdminUserRouter } = require('../modules/users/user.routes');
const { createSuperAdminPaymentRouter } = require('../modules/payments/payment.routes');
const { createGuestPaymentRouter } = require('../modules/payments/payment.routes');
const createResourceManagementRouter = require('./resource-management.routes');
const createAdminTrainManagementRouter = require('./admin-train-management.routes');
const createStaffStationManagementRouter = require('./staff-station-management.routes');
const { createRouteAdminRouter } = require('../modules/routes/route.routes');
const {
  createPublicBookingRouter,
  createGuestBookingRouter,
} = require('../modules/bookings/guest-booking.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ name: 'Train Booking API', version: 'v1' });
});

router.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', database: 'connected', version: 'v1' });
  } catch (error) {
    req.log.warn({ err: error }, 'Database health check failed');
    res.status(503).json({ status: 'error', database: 'disconnected', version: 'v1' });
  }
});

router.use('/fares', createFareRouter(services.fareCalculationService));
router.use('/auth', createAuthRouter(services));
router.use(createPublicRouter(services));
router.use(createPublicBookingRouter(services));
router.use(createGuestBookingRouter(services));
router.use(createGuestPaymentRouter(services));
const authenticate = authenticateFactory(services.authService);
router.use('/passenger', authenticate, createPassengerRouter(services));
router.use(authenticate, createPassengerRouter(services));
router.use('/super-admin', authenticate, createSuperAdminRouter(services));
router.use('/super-admin/manage', authenticate, createResourceManagementRouter(services));
router.use('/super-admin', authenticate, createSuperAdminPaymentRouter(services));
router.use('/super-admin/routes', authenticate, createRouteAdminRouter(services));
router.use('/super-admin', authenticate, createAdminRouter(services));
router.use('/admin', authenticate, createAdminUserRouter(services));
router.use('/admin', authenticate, createAdminRouter(services));
router.use('/admin/manage', authenticate, createAdminTrainManagementRouter(services));
router.use('/staff/manage', authenticate, createStaffStationManagementRouter(services));

module.exports = router;
