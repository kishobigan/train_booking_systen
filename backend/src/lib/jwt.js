'use strict';
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const AuthenticationError = require('../common/errors/AuthenticationError');
const config = require('../config/auth');
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sign(payload, { type, expiresIn }) {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is required');
  const now = Math.floor(Date.now() / 1000);
  const body = { sub: payload.userId, type, jti: randomUUID(), iat: now, exp: now + expiresIn };
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(body)}`;
  const signature = createHmac('sha256', config.jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}
function verify(token, expectedType) {
  try {
    const [header, payload, signature] = token.split('.');
    const unsigned = `${header}.${payload}`;
    const expected = createHmac('sha256', config.jwtSecret).update(unsigned).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const decoded = JSON.parse(Buffer.from(payload, 'base64url'));
    if (decoded.exp <= Math.floor(Date.now() / 1000) || decoded.type !== expectedType)
      throw new Error();
    return decoded;
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
}
module.exports = { sign, verify };
