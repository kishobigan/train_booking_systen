'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
class BookingController {
  constructor({ bookingService, bookingStatusService }) {
    this.bookingService = bookingService;
    this.bookingStatusService = bookingStatusService;
  }
  getStatusHistory = asyncHandler(async (req, res) => {
    const result = await this.bookingStatusService.getStatusHistory({
      bookingId: req.params.bookingId,
      requestingUser: req.user,
    });
    res.status(200).json(apiResponse.success(result));
  });
  cancelBooking = asyncHandler(async (req, res) => {
    const result = await this.bookingStatusService.cancelBooking({
      bookingId: req.params.bookingId,
      actor: { type: 'USER', userId: req.user?.id, role: req.user?.role },
      reason: req.body.reason,
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
