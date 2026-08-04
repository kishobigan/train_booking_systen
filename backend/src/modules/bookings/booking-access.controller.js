'use strict';

const AuthenticationError = require('../../common/errors/AuthenticationError');
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');

class BookingAccessController {
  constructor({ bookingAccessService, guestBookingConfig }) {
    this.service = bookingAccessService;
    this.guestBookingConfig = guestBookingConfig;
  }

  request = asyncHandler(async (req, res) => {
    const result = await this.service.requestAccess(req.body);
    res.status(200).json(apiResponse.success(result));
  });

  verify = asyncHandler(async (req, res) => {
    const result = await this.service.verifyAccess(req.body);
    res.cookie(`${this.guestBookingConfig.cookieName}_session`, Buffer.from(JSON.stringify({ bookingId: result.bookingId, token: result.guestAccessToken })).toString('base64url'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/public',
      expires: result.guestAccessTokenExpiresAt,
    });
    delete result.guestAccessToken;
    res.status(200).json(apiResponse.success({ bookingId: result.bookingId, guestAccessTokenExpiresAt: result.guestAccessTokenExpiresAt }));
  });

  summary = asyncHandler(async (req, res) => {
    const session = this.#readSession(req);
    const result = await this.service.getCustomerActivity(session);
    res.status(200).json(apiResponse.success(result));
  });

  end = asyncHandler(async (req, res) => {
    res.clearCookie(`${this.guestBookingConfig.cookieName}_session`, { path: '/api/v1/public' });
    res.status(200).json(apiResponse.success({ ended: true }));
  });

  #readSession(req) {
    const raw = this.#cookie(req, `${this.guestBookingConfig.cookieName}_session`);
    if (!raw) throw new AuthenticationError('Guest booking access session is required');
    try {
      const parsed = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
      return { bookingId: parsed.bookingId, token: parsed.token };
    } catch {
      throw new AuthenticationError('Guest booking access session is required');
    }
  }

  #cookie(req, name) {
    const header = req.get('cookie') || '';
    const match = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  }
}

module.exports = BookingAccessController;