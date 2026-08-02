'use strict';
const { formatAmount } = require('../../common/utils/money');
const toRefundDto = (r) => ({
  id: r.id,
  paymentId: r.paymentId,
  bookingId: r.bookingId,
  refundReference: r.refundReference,
  amount: formatAmount(r.amount),
  reason: r.reason,
  status: r.status,
  providerRefundReference: r.providerRefundReference,
  manualRefundReference: r.manualRefundReference,
  processedAt: r.processedAt,
  createdAt: r.createdAt,
});
module.exports = { toRefundDto };
