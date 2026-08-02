'use strict';
const { createHash, randomBytes } = require('node:crypto');
const AuthenticationError = require('../../common/errors/AuthenticationError');
const UserBlockedError = require('../../common/errors/UserBlockedError');
const ValidationError = require('../../common/errors/ValidationError');
const AUTH = require('../../common/constants/auth.constants');
const jwt = require('../../lib/jwt');
const password = require('../../lib/password');
const config = require('../../config/auth');
const digest = (token) => createHash('sha256').update(token).digest('hex');
class AuthService {
  constructor({ userRepository, refreshTokenRepository, auditService, transactionManager }) {
    Object.assign(this, {
      userRepository,
      refreshTokenRepository,
      auditService,
      transactionManager,
    });
  }
  async login({ identifier, password: plainPassword }) {
    const user = await this.userRepository.findForAuthentication(
      String(identifier || '')
        .trim()
        .toLowerCase()
    );
    if (!user || !(await password.verify(plainPassword, user.passwordHash)))
      throw new AuthenticationError('Invalid credentials.');
    this.validateAuthenticatedUser(user);
    if (user.mustChangePassword) {
      if (user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= new Date())
        throw new AuthenticationError('Temporary password has expired');
      return {
        requiresPasswordChange: true,
        passwordChangeToken: jwt.sign(
          { userId: user.id },
          { type: AUTH.PASSWORD_CHANGE_TOKEN, expiresIn: config.passwordChangeTtlSeconds }
        ),
        user: user.toJSON(),
      };
    }
    const tokens = await this.issueTokenPair(user);
    await this.auditService.record({
      userId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });
    return { requiresPasswordChange: false, user: user.toJSON(), ...tokens };
  }
  validateAuthenticatedUser(user) {
    if (!user || user.deletedAt) throw new AuthenticationError();
    if (!user.isActive || user.blockedAt) throw new UserBlockedError();
    return user;
  }
  async issueTokenPair(user, options = {}) {
    const accessToken = jwt.sign(
      { userId: user.id },
      { type: AUTH.ACCESS_TOKEN, expiresIn: config.accessTtlSeconds }
    );
    const refreshToken = `${randomBytes(32).toString('base64url')}.${jwt.sign({ userId: user.id }, { type: AUTH.REFRESH_TOKEN, expiresIn: config.refreshTtlSeconds })}`;
    await this.refreshTokenRepository.create(
      {
        userId: user.id,
        tokenHash: digest(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000),
      },
      options
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: config.accessTtlSeconds };
  }
  async refreshAccessToken({ refreshToken }) {
    const stored = await this.refreshTokenRepository.findActiveByHash(digest(refreshToken));
    if (!stored) throw new AuthenticationError('Invalid refresh token');
    const signed = refreshToken.slice(refreshToken.indexOf('.') + 1);
    const claims = jwt.verify(signed, AUTH.REFRESH_TOKEN);
    if (claims.sub !== stored.userId) throw new AuthenticationError('Invalid refresh token');
    const user = await this.userRepository.findByIdForAuthentication(stored.userId);
    this.validateAuthenticatedUser(user);
    if (user.mustChangePassword) throw new AuthenticationError('Password change required');
    await this.refreshTokenRepository.revoke(stored.id);
    return this.issueTokenPair(user);
  }
  rotateRefreshToken(input) {
    return this.refreshAccessToken(input);
  }
  async logout({ refreshToken }) {
    if (refreshToken) {
      const stored = await this.refreshTokenRepository.findActiveByHash(digest(refreshToken));
      if (stored) await this.refreshTokenRepository.revoke(stored.id);
    }
    return true;
  }
  async logoutAll(userId, options = {}) {
    await this.refreshTokenRepository.revokeAllForUser(userId, options);
    return true;
  }
  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);
    this.validateAuthenticatedUser(user);
    return user;
  }
  async changeInitialPassword({ token, currentPassword, newPassword, confirmPassword }) {
    if (newPassword !== confirmPassword)
      throw new ValidationError('Password confirmation does not match');
    const claims = jwt.verify(token, AUTH.PASSWORD_CHANGE_TOKEN);
    return this.transactionManager.execute(async (transaction) => {
      const user = await this.userRepository.findByIdForAuthentication(claims.sub, {
        transaction,
        lock: true,
      });
      this.validateAuthenticatedUser(user);
      if (!user.mustChangePassword)
        throw new ValidationError('Initial password has already been changed');
      if (!(await password.verify(currentPassword, user.passwordHash)))
        throw new AuthenticationError('Invalid credentials.');
      if (await password.verify(newPassword, user.passwordHash))
        throw new ValidationError('New password must differ from the temporary password');
      const passwordHash = await password.hash(newPassword);
      await user.update(
        {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          temporaryPasswordExpiresAt: null,
        },
        { transaction }
      );
      await this.refreshTokenRepository.revokeAllForUser(user.id, { transaction });
      await this.auditService.record(
        {
          userId: user.id,
          action: 'AUTH_INITIAL_PASSWORD_CHANGED',
          entityType: 'User',
          entityId: user.id,
        },
        { transaction }
      );
      return { user: user.toJSON(), ...(await this.issueTokenPair(user, { transaction })) };
    });
  }
}
module.exports = AuthService;
