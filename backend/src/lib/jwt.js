'use strict';
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const AUTH = require('../common/constants/auth.constants');
const InvalidTokenError = require('../common/errors/InvalidTokenError');
const TokenExpiredError = require('../common/errors/TokenExpiredError');
const config = require('../config/auth');
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const secretFor = (type) =>
  type === AUTH.REFRESH_TOKEN
    ? config.refreshSecret
    : type === AUTH.PASSWORD_CHANGE_TOKEN
      ? config.passwordChangeSecret
      : config.accessSecret;
function sign(payload, { type, expiresIn, jti = randomUUID() }) {
  const secret = secretFor(type);
  if (!secret) throw new Error(`${type} token secret is required`);
  const now = Math.floor(Date.now() / 1000);
  const body = {
    sub: payload.userId || payload.sub,
    ...(payload.role && { role: payload.role }),
    type,
    ...(payload.purpose && { purpose: payload.purpose }),
    jti,
    iss: config.issuer,
    aud: config.audience,
    iat: now,
    exp: now + expiresIn,
  };
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(body)}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}
function verify(token, expectedType) {
  try {
    if (typeof token !== 'string') throw new InvalidTokenError();
    const parts = token.split('.');
    if (parts.length !== 3) throw new InvalidTokenError();
    const [header, payload, signature] = parts;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url'));
    const expected = createHmac('sha256', secretFor(expectedType))
      .update(`${header}.${payload}`)
      .digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new InvalidTokenError();
    if (decoded.exp <= Math.floor(Date.now() / 1000)) throw new TokenExpiredError(expectedType);
    if (
      decoded.type !== expectedType ||
      decoded.iss !== config.issuer ||
      decoded.aud !== config.audience ||
      !decoded.sub
    )
      throw new InvalidTokenError();
    return decoded;
  } catch (error) {
    if (error instanceof InvalidTokenError || error instanceof TokenExpiredError) throw error;
    throw new InvalidTokenError();
  }
}
module.exports = { sign, verify };
