'use strict';
function cookieValue(header, name) {
  const item = String(header || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}
module.exports =
  ({ guestBookingAccessService, guestBookingConfig }) =>
  async (req, res, next) => {
    try {
      const bearer = req.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      const token =
        bearer ||
        cookieValue(req.get('Cookie'), `${guestBookingConfig.cookieName}_${req.params.bookingId}`);
      req.guestBooking = await guestBookingAccessService.authorize(req.params.bookingId, token);
      req.user = { guestBookingId: req.guestBooking.id };
      next();
    } catch (error) {
      next(error);
    }
  };
module.exports.forPayment =
  ({ guestBookingAccessService, guestBookingConfig, paymentService }) =>
  async (req, res, next) => {
    try {
      const payment = await paymentService.paymentRepository.findById(req.params.paymentId);
      if (!payment) throw new (require('../../common/errors/NotFoundError'))('Payment not found');
      const bearer = req.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      const token =
        bearer ||
        cookieValue(req.get('Cookie'), `${guestBookingConfig.cookieName}_${payment.bookingId}`);
      req.guestBooking = await guestBookingAccessService.authorize(payment.bookingId, token);
      req.user = { guestBookingId: req.guestBooking.id };
      next();
    } catch (error) {
      next(error);
    }
  };
