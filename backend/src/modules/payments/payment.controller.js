'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { validateCreatePayment } = require('./payment.validator');
const { toPaymentDto } = require('./payment.dto');
class PaymentController {
  constructor(services) {
    Object.assign(this, services);
  }
  create = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.paymentService.createPayment(
          validateCreatePayment({
            bookingId: req.params.bookingId,
            method: req.body.method,
            userId: req.user.id,
            role: req.user.role,
            guestBookingId: req.user.guestBookingId,
            idempotencyKey: req.get('Idempotency-Key'),
          })
        )
      )
    )
  );
  get = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        toPaymentDto(await this.paymentService.getPaymentById(req.params.paymentId, req.user))
      )
    )
  );
  status = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.paymentService.getPaymentStatus({
          paymentId: req.params.paymentId,
          requestingUser: req.user,
        })
      )
    )
  );
  verify = asyncHandler(async (req, res) => {
    const payment = await this.paymentService.getPaymentById(req.params.paymentId, req.user);
    if (payment.method !== 'CARD') {
      return res.json(apiResponse.success(toPaymentDto(payment)));
    }
    const result = await this.paymentService.verifyStripePayment({ paymentId: payment.id });
    return res.json(
      apiResponse.success({
        paymentId: payment.id,
        status: payment.status,
        providerStatus: result.intent.status,
      })
    );
  });
  uploadSlip = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.bankSlipService.uploadBankSlip({
          paymentId: req.params.paymentId,
          userId: req.user.id,
          role: req.user.role,
          guestBookingId: req.user.guestBookingId,
          file: req.file,
          ...req.body,
        })
      )
    )
  );
  pendingSlips = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.bankSlipService.findPending(req.user)))
  );
  getSlip = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.bankSlipService.getSlip({ paymentId: req.params.paymentId, actor: req.user })
      )
    )
  );
  downloadSlip = asyncHandler(async (req, res) => {
    const file = await this.bankSlipService.download({
      paymentId: req.params.paymentId,
      actor: req.user,
    });
    res
      .type(file.mimeType)
      .set('Content-Disposition', `attachment; filename="${file.fileName}"`)
      .send(file.buffer);
  });
  approveSlip = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.bankSlipService.approveBankSlip({
          paymentId: req.params.paymentId,
          actor: req.user,
          verificationNote: req.body.verificationNote,
          idempotencyKey: req.get('Idempotency-Key'),
        })
      )
    )
  );
  rejectSlip = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.bankSlipService.rejectBankSlip({
          paymentId: req.params.paymentId,
          actor: req.user,
          reason: req.body.reason,
          idempotencyKey: req.get('Idempotency-Key'),
        })
      )
    )
  );
  reconcile = asyncHandler(async (req, res) => {
    const payment = await this.paymentService.getPaymentById(req.params.paymentId, req.user);
    res.json(
      apiResponse.success(await this.paymentReconciliationService.reconcilePayment({ payment }))
    );
  });
  issues = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.paymentReconciliationService.findUnreconciledPayments(req.query)
      )
    )
  );
}
module.exports = PaymentController;
