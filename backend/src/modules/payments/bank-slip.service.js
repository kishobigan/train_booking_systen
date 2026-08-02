'use strict';
const path = require('node:path');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const BankSlipError = require('../../common/errors/BankSlipError');
const BankSlipVerificationError = require('../../common/errors/BankSlipVerificationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const fileHash = require('../../common/utils/file-hash');
const config = require('../../config/payment');
const { toPaymentDto, toBankSlipDto, toAdminBankSlipDto } = require('./payment.dto');
class BankSlipService {
  constructor(dependencies) {
    Object.assign(this, dependencies);
  }
  validateFile(file) {
    if (!file?.buffer?.length) throw new BankSlipError('A non-empty slip file is required');
    if (file.size > config.slip.maxBytes)
      throw new BankSlipError('Bank slip exceeds the configured size limit');
    if (!config.slip.allowedMimeTypes.includes(file.mimetype))
      throw new BankSlipError('Unsupported bank-slip file type');
    const signatures = {
      'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
      'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'application/pdf': (b) => b.subarray(0, 5).toString() === '%PDF-',
    };
    if (!signatures[file.mimetype]?.(file.buffer))
      throw new BankSlipError('File content does not match its declared type');
    return true;
  }
  async uploadBankSlip(input) {
    this.validateFile(input.file);
    const payment = await this.paymentService.getPaymentById(input.paymentId, {
      id: input.userId,
      role: input.role,
    });
    if (payment.method !== 'BANK_SLIP' || !['PENDING', 'REJECTED'].includes(payment.status))
      throw new BankSlipError('Payment does not accept a bank-slip upload');
    const booking = await this.bookingRepository.findById(payment.bookingId);
    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date())
      throw new BankSlipError('Booking hold has expired');
    const hash = fileHash(input.file.buffer);
    if (await this.bankSlipRepository.findByHash(hash))
      throw new BankSlipError('This bank slip has already been submitted');
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' }[
      input.file.mimetype
    ];
    const stored = await this.storageProvider.upload({ buffer: input.file.buffer, extension });
    try {
      const slip = await this.transactionManager.execute(async (transaction) => {
        const locked = await this.paymentRepository.findByIdForUpdate(payment.id, transaction);
        if (!['PENDING', 'REJECTED'].includes(locked.status))
          throw new BankSlipError('Payment status changed before upload');
        await this.bankSlipRepository.supersede(payment.id, { transaction });
        const created = await this.bankSlipRepository.create(
          {
            paymentId: payment.id,
            uploadedByUserId: input.userId,
            originalFileName: path.basename(input.file.originalname || '').slice(0, 255),
            ...stored,
            mimeType: input.file.mimetype,
            fileSizeBytes: input.file.size,
            fileHash: hash,
            bankTransactionReference: input.bankTransactionReference,
            transferDate: input.transferDate,
            depositorName: input.depositorName,
            submittedAmount: input.submittedAmount,
            status: 'UNDER_REVIEW',
          },
          { transaction }
        );
        await this.paymentService.transition(locked, 'AWAITING_VERIFICATION', {}, { transaction });
        await this.auditService.record(
          {
            userId: input.userId,
            action: 'BANK_SLIP_UPLOADED',
            entityType: 'Payment',
            entityId: payment.id,
            newValues: { slipId: created.id, fileHash: hash },
          },
          { transaction }
        );
        return created;
      });
      return toBankSlipDto(slip);
    } catch (error) {
      await this.storageProvider.delete(stored.storageKey);
      throw error;
    }
  }
  async approveBankSlip({ paymentId, actor, verificationNote, idempotencyKey }) {
    return this.transactionManager.executeSerializable(async (transaction) => {
      const idem = await this.idempotencyService.begin({
        scope: `bank-slip:approve:${actor.id}`,
        key: idempotencyKey,
        request: { paymentId, verificationNote },
        transaction,
      });
      if (idem?.responseBody) return idem.responseBody;
      const payment = await this.paymentRepository.findByIdForUpdate(paymentId, transaction);
      if (!payment) throw new NotFoundError('Payment not found');
      const booking = await this.bookingRepository.findByIdForUpdate(
        payment.bookingId,
        transaction
      );
      await this.#authorizeReviewer(actor, booking.journeyId, transaction);
      if (payment.method !== 'BANK_SLIP' || payment.status !== 'AWAITING_VERIFICATION')
        throw new BankSlipVerificationError('Payment is not awaiting bank-slip verification');
      const slip = await this.bankSlipRepository.findLatest(payment.id, {
        transaction,
        lock: transaction.LOCK?.UPDATE ?? true,
      });
      if (!slip || !['UPLOADED', 'UNDER_REVIEW'].includes(slip.status))
        throw new BankSlipVerificationError('No reviewable bank slip exists');
      this.paymentService.verifyPaymentAmount(payment, booking);
      const duplicatePaid = await this.paymentRepository.findSuccessfulByBookingId(booking.id, {
        transaction,
      });
      if (duplicatePaid && duplicatePaid.id !== payment.id)
        throw new BankSlipVerificationError('Another payment already paid this booking');
      await slip.update(
        {
          status: 'APPROVED',
          verifiedByUserId: actor.id,
          verifiedAt: new Date(),
          verificationNote,
        },
        { transaction }
      );
      await this.paymentService.markPaid(payment, {}, { transaction });
      const completion = await this.paymentService.completePaidBooking({
        payment,
        actor: { type: 'USER', userId: actor.id, role: actor.role },
        transaction,
      });
      await this.auditService.record(
        {
          userId: actor.id,
          action: 'BANK_SLIP_APPROVED',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: { slipId: slip.id, verificationNote },
        },
        { transaction }
      );
      const response = {
        payment: toPaymentDto(payment),
        slip: toAdminBankSlipDto(slip),
        bookingStatus: completion.booking.status,
        manualResolutionRequired: completion.manualResolutionRequired,
      };
      await this.idempotencyService.complete(
        idem,
        { resourceType: 'Payment', resourceId: payment.id, responseBody: response },
        transaction
      );
      return response;
    });
  }
  async rejectBankSlip({ paymentId, actor, reason, idempotencyKey }) {
    if (!String(reason || '').trim())
      throw new BankSlipVerificationError('Rejection reason is required');
    return this.transactionManager.execute(async (transaction) => {
      const idem = await this.idempotencyService.begin({
        scope: `bank-slip:reject:${actor.id}`,
        key: idempotencyKey,
        request: { paymentId, reason },
        transaction,
      });
      if (idem?.responseBody) return idem.responseBody;
      const payment = await this.paymentRepository.findByIdForUpdate(paymentId, transaction);
      if (!payment) throw new NotFoundError('Payment not found');
      const booking = await this.bookingRepository.findById(payment.bookingId, { transaction });
      await this.#authorizeReviewer(actor, booking.journeyId, transaction);
      if (payment.method !== 'BANK_SLIP' || payment.status !== 'AWAITING_VERIFICATION')
        throw new BankSlipVerificationError('Payment is not awaiting verification');
      const slip = await this.bankSlipRepository.findLatest(payment.id, {
        transaction,
        lock: transaction.LOCK?.UPDATE ?? true,
      });
      if (!slip) throw new BankSlipVerificationError('Bank slip not found');
      await slip.update(
        {
          status: 'REJECTED',
          rejectedByUserId: actor.id,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
        { transaction }
      );
      await this.paymentService.markRejected(payment, { failureMessage: reason }, { transaction });
      await this.auditService.record(
        {
          userId: actor.id,
          action: 'BANK_SLIP_REJECTED',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: { reason },
        },
        { transaction }
      );
      const response = { payment: toPaymentDto(payment), slip: toAdminBankSlipDto(slip) };
      await this.idempotencyService.complete(
        idem,
        { resourceType: 'Payment', resourceId: payment.id, responseBody: response },
        transaction
      );
      return response;
    });
  }
  async getSlip({ paymentId, actor }) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    const booking = await this.bookingRepository.findById(payment.bookingId);
    if (actor.role === 'ADMIN')
      await this.accessControlService.assertAdminJourneyAccess({
        actor,
        journeyId: booking.journeyId,
      });
    else if (actor.role !== 'SUPER_ADMIN' && booking.userId !== actor.id)
      throw new AuthorizationError();
    const slip = await this.bankSlipRepository.findLatest(payment.id);
    if (!slip) throw new NotFoundError('Bank slip not found');
    return toAdminBankSlipDto(slip);
  }
  async findPending(actor) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) throw new AuthorizationError();
    const slips = await this.bankSlipRepository.findPending();
    if (actor.role === 'SUPER_ADMIN') return slips.map(toAdminBankSlipDto);
    const permitted = [];
    for (const slip of slips) {
      try {
        await this.accessControlService.assertAdminJourneyAccess({
          actor,
          journeyId: slip.payment.booking.journeyId,
        });
        permitted.push(toAdminBankSlipDto(slip));
      } catch (error) {
        if (!(error instanceof AuthorizationError)) throw error;
      }
    }
    return permitted;
  }
  async download({ paymentId, actor }) {
    await this.getSlip({ paymentId, actor });
    const slip = await this.bankSlipRepository.findLatest(paymentId);
    return {
      buffer: await this.storageProvider.download(slip.storageKey),
      mimeType: slip.mimeType,
      fileName: `bank-slip-${slip.id}${path.extname(slip.storedFileName)}`,
    };
  }
  async #authorizeReviewer(actor, journeyId, transaction) {
    if (actor.role === 'SUPER_ADMIN') return true;
    if (actor.role !== 'ADMIN') throw new AuthorizationError('Only admins may review bank slips');
    return this.accessControlService.assertAdminJourneyAccess({ actor, journeyId, transaction });
  }
}
module.exports = BankSlipService;
