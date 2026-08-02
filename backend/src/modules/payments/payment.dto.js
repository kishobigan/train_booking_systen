'use strict';
const { formatAmount } = require('../../common/utils/money');
const toPaymentDto = (p) => ({
  id: p.id,
  bookingId: p.bookingId,
  paymentReference: p.paymentReference,
  method: p.method,
  status: p.status,
  amount: formatAmount(p.amount),
  currency: p.currency,
  paidAt: p.paidAt,
  createdAt: p.createdAt,
});
const toPaymentStatusDto = toPaymentDto;
const toBankSlipDto = (s) => ({
  id: s.id,
  paymentId: s.paymentId,
  status: s.status,
  mimeType: s.mimeType,
  fileSizeBytes: s.fileSizeBytes,
  bankTransactionReference: s.bankTransactionReference,
  transferDate: s.transferDate,
  depositorName: s.depositorName,
  submittedAmount: s.submittedAmount,
  uploadedAt: s.uploadedAt,
});
const toAdminBankSlipDto = (s) => ({
  ...toBankSlipDto(s),
  originalFileName: s.originalFileName,
  verifiedByUserId: s.verifiedByUserId,
  verifiedAt: s.verifiedAt,
  rejectedByUserId: s.rejectedByUserId,
  rejectedAt: s.rejectedAt,
  verificationNote: s.verificationNote,
  rejectionReason: s.rejectionReason,
});
module.exports = { toPaymentDto, toPaymentStatusDto, toBankSlipDto, toAdminBankSlipDto };
