'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { bookingHoldDto } = require('./booking.dto');
const { validateHold, validateConfirmation, validateCancellation } = require('./booking.validator');
class BookingController {
  constructor({ bookingService, bookingStatusService }) {
    this.bookingService = bookingService;
    this.bookingStatusService = bookingStatusService;
  }
  createHold = asyncHandler(async (req, res) => {
    const input = validateHold(
      bookingHoldDto({
        ...req.body,
        idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey,
      })
    );
    const result = await this.bookingService.createBookingHold({ userId: req.user.id, ...input });
    res.status(201).json(apiResponse.success(result));
  });
  confirm = asyncHandler(async (req, res) => {
    const input = validateConfirmation({
      bookingId: req.params.bookingId,
      paymentId: req.body.paymentId,
    });
    const result = await this.bookingService.confirmBooking({
      ...input,
      userId: req.user.id,
      actor: { type: 'USER', userId: req.user.id, role: req.user.role },
    });
    res.status(200).json(apiResponse.success(result));
  });
  getStatusHistory = asyncHandler(async (req, res) => {
    const result = await this.bookingStatusService.getStatusHistory({
      bookingId: req.params.bookingId,
      requestingUser: req.user,
    });
    res.status(200).json(apiResponse.success(result));
  });
  cancelBooking = asyncHandler(async (req, res) => {
    const input = validateCancellation({
      bookingId: req.params.bookingId,
      reason: req.body.reason,
    });
    const result = await this.bookingService.cancelBooking({
      ...input,
      requestingUser: req.user,
      actor: { type: 'USER', userId: req.user.id, role: req.user.role },
    });
    res.status(200).json(apiResponse.success(result));
  });
  getById = asyncHandler(async (req, res) => {
    const booking = await this.bookingService.getBookingById(req.params.bookingId);
    this.bookingService.validateBookingOwnership(booking, req.user);
    res.status(200).json(apiResponse.success(booking));
  });
  getByReference = asyncHandler(async (req, res) => {
    const booking = await this.bookingService.getBookingByReference(req.params.reference);
    this.bookingService.validateBookingOwnership(booking, req.user);
    res.status(200).json(apiResponse.success(booking));
  });
  getMyBookings = asyncHandler(async (req, res) => {
    res
      .status(200)
      .json(apiResponse.success(await this.bookingService.getUserBookings(req.user.id, req.query)));
  });
  getTicket = asyncHandler(async (req, res) => {
    const booking = await this.bookingService.getBookingById(req.params.bookingId);
    this.bookingService.validateBookingOwnership(booking, req.user);
    res
      .status(200)
      .json(apiResponse.success(await this.bookingService.getBookingTicket(booking.id)));
  });
  getJourneyBookings = asyncHandler(async (req, res) => {
    res
      .status(200)
      .json(
        apiResponse.success(
          await this.bookingService.getJourneyBookings(req.params.journeyId, req.query)
        )
      );
  });
  completeBooking = asyncHandler(async (req, res) => {
    const result = await this.bookingService.completeBooking({
      bookingId: req.params.bookingId,
      actor: { type: 'USER', userId: req.user.id, role: req.user.role },
      reason: req.body.reason || 'Journey completed.',
    });
    res.status(200).json(apiResponse.success(result));
  });
  updateStatus = asyncHandler(async (req, res) => {
    const result = await this.bookingStatusService.transitionBookingStatus({
      bookingId: req.params.bookingId,
      targetStatus: req.body.targetStatus,
      actor: { type: 'USER', userId: req.user?.id, role: req.user?.role },
      reason: req.body.reason,
      metadata: req.body.metadata,
    });
    res.status(200).json(apiResponse.success(result));
  });
}
module.exports = BookingController;
