'use strict';
const AuthenticationError = require('../../common/errors/AuthenticationError');
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const dto = require('./auth.dto');
const validator = require('./auth.validator');
class AuthController {
  constructor({ authService, authConfig, userService }) {
    Object.assign(this, { authService, authConfig, userService });
  }
  login = asyncHandler(async (req, res) => {
    const result = await this.authService.login({
      ...validator.validateLogin(dto.loginDto(req.body)),
      context: this.#context(req),
    });
    if (result.refreshToken) this.#setRefreshCookie(res, result.refreshToken);
    res.json(apiResponse.success(dto.toLoginResponseDto(result)));
  });
  changeInitialPassword = asyncHandler(async (req, res) => {
    const token = this.#bearer(req);
    const result = await this.authService.changeInitialPassword({
      token,
      ...validator.validatePasswordChange(dto.passwordChangeDto(req.body)),
      context: this.#context(req),
    });
    this.#setRefreshCookie(res, result.refreshToken);
    res.json(apiResponse.success(dto.toPasswordChangeResponseDto(result)));
  });
  refresh = asyncHandler(async (req, res) => {
    const result = await this.authService.refreshAccessToken({
      refreshToken: this.#refreshCookie(req),
      context: this.#context(req),
    });
    this.#setRefreshCookie(res, result.refreshToken);
    res.json(apiResponse.success(dto.toRefreshResponseDto(result)));
  });
  logout = asyncHandler(async (req, res) => {
    await this.authService.logout({
      refreshToken: this.#refreshCookie(req),
      context: this.#context(req),
    });
    this.#clearRefreshCookie(res);
    res.status(204).send();
  });
  logoutAll = asyncHandler(async (req, res) => {
    await this.authService.logoutAll(req.user.id, { context: this.#context(req) });
    this.#clearRefreshCookie(res);
    res.status(204).send();
  });
  getCurrentUser = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(dto.toSafeUserDto(await this.authService.getCurrentUser(req.user.id)))
    )
  );
  me = this.getCurrentUser;
  changePassword = asyncHandler(async (req, res) => {
    const input = validator.validatePasswordChange(dto.passwordChangeDto(req.body));
    const user = await this.userService.changeOwnPassword({
      actor: req.user,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    res.json(apiResponse.success(dto.toSafeUserDto(user)));
  });
  #bearer(req) {
    const authorization = req.get('authorization') || '';
    if (!/^Bearer\s+\S+$/.test(authorization))
      throw new AuthenticationError('A password-change token is required');
    return authorization.slice(7);
  }
  #refreshCookie(req) {
    const name = this.authConfig.cookie.name;
    if (req.cookies?.[name]) return req.cookies[name];
    const header = req.get('cookie') || '';
    const match = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  }
  #setRefreshCookie(res, token) {
    res.cookie(this.authConfig.cookie.name, token, {
      ...this.authConfig.cookie,
      maxAge: this.authConfig.refreshTokenLifetimeMs,
    });
  }
  #clearRefreshCookie(res) {
    const { name, ...options } = this.authConfig.cookie;
    res.clearCookie(name, options);
  }
  #context(req) {
    const requestId = String(req.id || '');
    return {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId
      )
        ? requestId
        : undefined,
    };
  }
}
module.exports = AuthController;
