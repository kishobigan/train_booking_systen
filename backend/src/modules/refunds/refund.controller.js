'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { validateRefund } = require('./refund.validator');
class RefundController {
  constructor(refundService) {
    this.refundService = refundService;
  }
  create = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.refundService.createRefund(
          validateRefund({
            paymentId: req.params.paymentId,
            requestedAmount: req.body.amount,
            reason: req.body.reason,
            actor: req.user,
            idempotencyKey: req.get('Idempotency-Key'),
          })
        )
      )
    )
  );
  list = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.refundService.getRefunds(req.user, req.query)))
  );
  get = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(await this.refundService.getRefundById(req.params.refundId, req.user))
    )
  );
  listPayment = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.refundService.getPaymentRefunds(req.params.paymentId, req.user)
      )
    )
  );
  completeManual = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.refundService.completeManualRefund({
          refundId: req.params.refundId,
          actor: req.user,
          bankReference: req.body.bankReference,
          note: req.body.note,
        })
      )
    )
  );
  retry = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.refundService.retryRefund({ refundId: req.params.refundId, actor: req.user })
      )
    )
  );
}
module.exports = RefundController;
