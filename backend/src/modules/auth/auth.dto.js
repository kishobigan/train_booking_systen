'use strict';
function loginDto(body = {}) {
  return { identifier: body.identifier, password: body.password };
}
function passwordChangeDto(body = {}) {
  return {
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    confirmPassword: body.confirmPassword,
  };
}
function toSafeUserDto(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    assignedJourneyIds: (user.adminJourneys || []).map((journey) => journey.id),
    assignedTrainIds: (user.adminTrains || []).map((train) => train.id),
    assignedStationIds: (user.staffStations || []).map((station) => station.id),
    scope: {
      assignedTrainIds: (user.adminTrains || []).map((train) => train.id),
      assignedJourneyIds: (user.adminJourneys || []).map((journey) => journey.id),
      assignedStationIds: (user.staffStations || []).map((station) => station.id),
    },
  };
}
function toLoginResponseDto(result) {
  return result.requiresPasswordChange
    ? {
        requiresPasswordChange: true,
        passwordChangeToken: result.passwordChangeToken,
        user: { id: result.user.id, fullName: result.user.fullName, role: result.user.role },
      }
    : {
        requiresPasswordChange: false,
        user: toSafeUserDto(result.user),
        accessToken: result.accessToken,
        accessTokenExpiresIn: result.expiresIn,
      };
}
function toPasswordChangeResponseDto(result) {
  return {
    requiresPasswordChange: false,
    user: toSafeUserDto(result.user),
    accessToken: result.accessToken,
    accessTokenExpiresIn: result.expiresIn,
  };
}
function toRefreshResponseDto(result) {
  return { accessToken: result.accessToken, accessTokenExpiresIn: result.expiresIn };
}
module.exports = {
  loginDto,
  passwordChangeDto,
  toSafeUserDto,
  toLoginResponseDto,
  toPasswordChangeResponseDto,
  toRefreshResponseDto,
};
