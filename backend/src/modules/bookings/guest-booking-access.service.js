'use strict';
const crypto = require('node:crypto');
const AuthenticationError = require('../../common/errors/AuthenticationError');
const NotFoundError = require('../../common/errors/NotFoundError');

class GuestBookingAccessService {
  constructor({ bookingRepository, config, clock = () => new Date() }) {
    this.bookingRepository = bookingRepository;
    this.config = config;
    this.clock = clock;
  }
  hash(token) {
    return crypto.createHmac('sha256', this.config.secret).update(token).digest('hex');
  }
  issue() {
    const token = crypto.randomBytes(32).toString('base64url');
    return {
      token,
      hash: this.hash(token),
      expiresAt: new Date(this.clock().getTime() + this.config.ttlSeconds * 1000),
    };
  }
  async authorize(bookingId, token) {
    if (!token) throw new AuthenticationError('Guest booking access token is required');
    const booking = await this.bookingRepository.findDetails(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    const actual = Buffer.from(this.hash(token), 'hex');
    const expected = Buffer.from(booking.guestAccessTokenHash || '', 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual))
      throw new AuthenticationError('Invalid guest booking access token');
    if (
      !booking.guestAccessTokenExpiresAt ||
      new Date(booking.guestAccessTokenExpiresAt) <= this.clock()
    )
      throw new AuthenticationError('Guest booking access token has expired');
    return booking;
  }
}
module.exports = GuestBookingAccessService;
