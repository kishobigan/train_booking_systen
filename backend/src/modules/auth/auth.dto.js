'use strict';
module.exports = {
  loginDto: (body = {}) => ({ identifier: body.identifier, password: body.password }),
  passwordChangeDto: (body = {}) => ({
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    confirmPassword: body.confirmPassword,
  }),
  refreshDto: (body = {}) => ({ refreshToken: body.refreshToken }),
};
