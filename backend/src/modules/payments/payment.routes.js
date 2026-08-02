'use strict';
const express = require('express');
const multer = require('multer');
const PaymentController = require('./payment.controller');
const RefundController = require('../refunds/refund.controller');
const authorize = require('../../common/middleware/authorize.middleware');
const config = require('../../config/payment');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.slip.maxBytes, files: 1 },
});
function createPassengerPaymentRouter(services) {
  const router = express.Router();
  const payment = new PaymentController(services);
  const refund = new RefundController(services.refundService);
  router.post('/bookings/:bookingId/payments', payment.create);
  router.get('/payments/:paymentId', payment.get);
  router.get('/payments/:paymentId/status', payment.status);
  router.post('/payments/:paymentId/verify', payment.verify);
  router.post('/payments/:paymentId/bank-slip', upload.single('file'), payment.uploadSlip);
  router.get('/payments/:paymentId/refunds', refund.listPayment);
  return router;
}
function createAdminPaymentRouter(services) {
  const router = express.Router();
  const payment = new PaymentController(services);
  const refund = new RefundController(services.refundService);
  router.use(authorize('ADMIN', 'SUPER_ADMIN'));
  router.get('/payments/bank-slips/pending', payment.pendingSlips);
  router.get('/payments/:paymentId/bank-slip', payment.getSlip);
  router.get('/payments/:paymentId/bank-slip/download', payment.downloadSlip);
  router.post('/payments/:paymentId/bank-slip/approve', payment.approveSlip);
  router.post('/payments/:paymentId/bank-slip/reject', payment.rejectSlip);
  router.post('/payments/:paymentId/refunds', refund.create);
  router.get('/refunds', refund.list);
  router.get('/refunds/:refundId', refund.get);
  router.post('/refunds/:refundId/complete-manual', refund.completeManual);
  router.post('/refunds/:refundId/retry', refund.retry);
  return router;
}
function createSuperAdminPaymentRouter(services) {
  const router = express.Router();
  const payment = new PaymentController(services);
  router.use(authorize('SUPER_ADMIN'));
  router.get('/payments/reconciliation/issues', payment.issues);
  router.post('/payments/:paymentId/reconcile', payment.reconcile);
  return router;
}
function stripeWebhookHandler(services) {
  return async (req, res, next) => {
    try {
      const result = await services.stripeWebhookService.processRawWebhook({
        rawBody: req.body,
        signature: req.get('Stripe-Signature'),
      });
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
module.exports = {
  createPassengerPaymentRouter,
  createAdminPaymentRouter,
  createSuperAdminPaymentRouter,
  stripeWebhookHandler,
};
