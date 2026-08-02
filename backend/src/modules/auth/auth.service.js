'use strict';
const { createHash, randomUUID, timingSafeEqual } = require('node:crypto');
const AuthenticationError = require('../../common/errors/AuthenticationError');
const InvalidTokenError = require('../../common/errors/InvalidTokenError');
const UserBlockedError = require('../../common/errors/UserBlockedError');
const ValidationError = require('../../common/errors/ValidationError');
const AUTH = require('../../common/constants/auth.constants');
const defaultJwt = require('../../lib/jwt');
const defaultPassword = require('../../lib/password');
const config = require('../../config/auth');
const digest = (token) => createHash('sha256').update(token).digest('hex');
class AuthService {
  constructor({
    userRepository,
    refreshTokenRepository,
    auditService,
    transactionManager,
    passwordService = defaultPassword,
    jwtService = defaultJwt,
    clock = () => new Date(),
  }) {
    Object.assign(this, {
      userRepository,
      refreshTokenRepository,
      auditService,
      transactionManager,
      passwordService,
      jwtService,
      clock,
    });
  }
  async login({ identifier, password: plainPassword, context = {} }) {
    const normalized = this.normalizeIdentifier(identifier);
    const user = await this.userRepository.findForAuthentication(normalized);
    if (!user || !(await this.passwordService.verify(plainPassword, user.passwordHash))) {
      await this.#audit({ action: 'LOGIN_FAILED', userId: user?.id, context });
      throw this.#invalidCredentials();
    }
    try {
      this.validateAuthenticatedUser(user);
    } catch (error) {
      await this.#audit({ action: 'LOGIN_FAILED', userId: user.id, context });
      throw error;
    }
    if (user.mustChangePassword) {
      if (user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= this.clock())
        throw new AuthenticationError('Temporary password has expired');
      await this.#audit({
        action: 'LOGIN_SUCCEEDED',
        userId: user.id,
        context,
        metadata: { requiresPasswordChange: true },
      });
      return {
        requiresPasswordChange: true,
        passwordChangeToken: this.jwtService.sign(
          { userId: user.id, purpose: 'initial_password_change' },
          { type: AUTH.PASSWORD_CHANGE_TOKEN, expiresIn: config.passwordChangeTtlSeconds }
        ),
        user: user.toJSON(),
      };
    }
    const tokens = await this.transactionManager.execute(async (transaction) =>
      this.issueTokenPair(user, { transaction })
    );
    await this.#audit({ action: 'LOGIN_SUCCEEDED', userId: user.id, context });
    return { requiresPasswordChange: false, user: user.toJSON(), ...tokens };
  }
  normalizeIdentifier(identifier) {
    const value = String(identifier || '').trim();
    return value.includes('@') ? value.toLowerCase() : value.replace(/[\s()-]/g, '');
  }
  validateAuthenticatedUser(user) {
    if (!user || user.deletedAt) throw new AuthenticationError();
    if (!user.isActive || user.blockedAt) throw new UserBlockedError();
    return user;
  }
  async issueTokenPair(user, options = {}) {
    const refreshTokenId = randomUUID();
    const accessToken = this.jwtService.sign(
      { userId: user.id, role: user.role },
      { type: AUTH.ACCESS_TOKEN, expiresIn: config.accessTtlSeconds }
    );
    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { type: AUTH.REFRESH_TOKEN, expiresIn: config.refreshTtlSeconds, jti: refreshTokenId }
    );
    await this.refreshTokenRepository.create(
      {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: digest(refreshToken),
        expiresAt: new Date(this.clock().getTime() + config.refreshTtlSeconds * 1000),
      },
      options
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: config.accessTtlSeconds };
  }
  async refreshAccessToken({ refreshToken, context = {} }) {
    if (!refreshToken) throw this.#invalidRefresh();
    const claims = this.jwtService.verify(refreshToken, AUTH.REFRESH_TOKEN);
    const result = await this.transactionManager.execute(async (transaction) => {
      const stored = await this.refreshTokenRepository.findByIdForUpdate(claims.jti, transaction);
      const validHash = stored && this.#sameHash(stored.tokenHash, digest(refreshToken));
      if (
        !stored ||
        stored.userId !== claims.sub ||
        !validHash ||
        stored.revokedAt ||
        stored.expiresAt <= this.clock()
      ) {
        await this.refreshTokenRepository.revokeAllForUser(claims.sub, { transaction });
        await this.#audit({
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          userId: claims.sub,
          context,
          transaction,
        });
        return { reuseDetected: true };
      }
      const user = await this.userRepository.findByIdForAuthentication(claims.sub, { transaction });
      this.validateAuthenticatedUser(user);
      if (user.mustChangePassword) throw new AuthenticationError('Password change required');
      await this.refreshTokenRepository.revoke(stored.id, { transaction });
      const tokens = await this.issueTokenPair(user, { transaction });
      await this.#audit({ action: 'TOKEN_REFRESHED', userId: user.id, context, transaction });
      return tokens;
    });
    if (result.reuseDetected) throw this.#invalidRefresh();
    return result;
  }
  rotateRefreshToken(input) {
    return this.refreshAccessToken(input);
  }
  async logout({ refreshToken, context = {} }) {
    if (!refreshToken) return true;
    try {
      const claims = this.jwtService.verify(refreshToken, AUTH.REFRESH_TOKEN);
      await this.transactionManager.execute(async (transaction) => {
        const stored = await this.refreshTokenRepository.findByIdForUpdate(claims.jti, transaction);
        if (stored && this.#sameHash(stored.tokenHash, digest(refreshToken)))
          await this.refreshTokenRepository.revoke(stored.id, { transaction });
        await this.#audit({
          action: 'LOGOUT',
          userId: stored?.userId || claims.sub,
          context,
          transaction,
        });
      });
    } catch (error) {
      if (!(error instanceof InvalidTokenError) && error.code !== 'TOKEN_EXPIRED') throw error;
    }
    return true;
  }
  async logoutAll(userId, options = {}) {
    await this.refreshTokenRepository.revokeAllForUser(
      userId,
      options.transaction ? { transaction: options.transaction } : {}
    );
    await this.#audit({
      action: 'LOGOUT_ALL',
      userId,
      context: options.context,
      transaction: options.transaction,
    });
    return true;
  }
  async getCurrentUser(userId) {
    const user = await this.userRepository.findByIdForAuthentication(userId);
    this.validateAuthenticatedUser(user);
    return user;
  }
  recordAuthenticationFailure({ userId, context }) {
    return this.#audit({ action: 'AUTHENTICATION_FAILED', userId, context });
  }
  async changeInitialPassword({
    token,
    currentPassword,
    newPassword,
    confirmPassword,
    context = {},
  }) {
    if (newPassword !== confirmPassword)
      throw new ValidationError('Password confirmation does not match');
    this.passwordService.validatePassword(newPassword);
    const claims = this.jwtService.verify(token, AUTH.PASSWORD_CHANGE_TOKEN);
    if (claims.purpose !== 'initial_password_change') throw new InvalidTokenError();
    return this.transactionManager.execute(async (transaction) => {
      const user = await this.userRepository.findByIdForAuthentication(claims.sub, {
        transaction,
        lock: transaction.LOCK?.UPDATE ?? true,
      });
      this.validateAuthenticatedUser(user);
      if (!user.mustChangePassword)
        throw new ValidationError('Initial password has already been changed');
      if (user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= this.clock())
        throw new AuthenticationError('Temporary password has expired');
      if (!(await this.passwordService.verify(currentPassword, user.passwordHash)))
        throw this.#invalidCredentials();
      if (await this.passwordService.verify(newPassword, user.passwordHash))
        throw new ValidationError('New password must differ from the temporary password');
      const passwordHash = await this.passwordService.hash(newPassword);
      await user.update(
        {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: this.clock(),
          temporaryPasswordExpiresAt: null,
        },
        { transaction }
      );
      await this.refreshTokenRepository.revokeAllForUser(user.id, { transaction });
      await this.#audit({
        action: 'INITIAL_PASSWORD_CHANGED',
        userId: user.id,
        context,
        transaction,
      });
      return {
        requiresPasswordChange: false,
        user: user.toJSON(),
        ...(await this.issueTokenPair(user, { transaction })),
      };
    });
  }
  #sameHash(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    return a.length === b.length && timingSafeEqual(a, b);
  }
  #invalidCredentials() {
    const error = new AuthenticationError('Invalid credentials.');
    error.code = 'INVALID_CREDENTIALS';
    return error;
  }
  #invalidRefresh() {
    const error = new AuthenticationError('The refresh token is invalid or has been revoked.');
    error.code = 'INVALID_REFRESH_TOKEN';
    return error;
  }
  #audit({ action, userId, context = {}, metadata, transaction }) {
    if (!this.auditService?.record) return null;
    const requestId = String(context.requestId || '');
    return this.auditService.record(
      {
        userId: userId || null,
        action,
        entityType: 'User',
        entityId: userId || null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId:
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            requestId
          )
            ? requestId
            : undefined,
        newValues: metadata,
      },
      transaction ? { transaction } : {}
    );
  }
}
module.exports = AuthService;
