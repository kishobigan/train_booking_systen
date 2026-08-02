'use strict';
module.exports = Object.freeze({
  supportedCurrencies: (process.env.PAYMENT_CURRENCIES || 'LKR')
    .split(',')
    .map((v) => v.trim().toUpperCase()),
  bank: {
    enabled: process.env.BANK_PAYMENT_ENABLED === 'true',
    bankName: process.env.BANK_NAME,
    accountName: process.env.BANK_ACCOUNT_NAME,
    accountNumber: process.env.BANK_ACCOUNT_NUMBER,
    branch: process.env.BANK_BRANCH,
    swiftCode: process.env.BANK_SWIFT_CODE,
    referencePrefix: process.env.BANK_PAYMENT_REFERENCE_PREFIX || 'TRAIN',
  },
  slip: {
    maxBytes: Number(process.env.BANK_SLIP_MAX_SIZE_MB || 5) * 1024 * 1024,
    allowedMimeTypes: (
      process.env.BANK_SLIP_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,application/pdf'
    ).split(','),
    storageRoot:
      process.env.BANK_SLIP_STORAGE_ROOT ||
      require('node:path').resolve(process.cwd(), 'storage/bank-slips'),
  },
  pendingExpiryMinutes: Number(process.env.PAYMENT_PENDING_EXPIRY_MINUTES || 15),
  idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 24),
});
