'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const dto = require('./auth.dto');
const validator = require('./auth.validator');
class AuthController {
  constructor(authService, userService) {
    this.authService = authService;
    this.userService = userService;
  }
  login = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.authService.login(validator.validateLogin(dto.loginDto(req.body)))
      )
    )
  );
  changeInitialPassword = asyncHandler(async (req, res) => {
    const authorization = req.get('authorization') || '';
    const result = await this.authService.changeInitialPassword({
      token: authorization.startsWith('Bearer ') ? authorization.slice(7) : '',
      ...validator.validatePasswordChange(dto.passwordChangeDto(req.body)),
    });
    res.json(apiResponse.success(result));
  });
  refresh = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.authService.refreshAccessToken(
          validator.validateRefresh(dto.refreshDto(req.body))
        )
      )
    )
  );
  logout = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.authService.logout(dto.refreshDto(req.body))))
  );
  logoutAll = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.authService.logoutAll(req.user.id)))
  );
  me = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.authService.getCurrentUser(req.user.id)))
  );
  changePassword = asyncHandler(async (req, res) => {
    const input = validator.validatePasswordChange(dto.passwordChangeDto(req.body));
    const user = await this.userService.changeOwnPassword({
      actor: req.user,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    res.json(apiResponse.success(user));
  });
}
module.exports = AuthController;
