'use strict';
module.exports = {
  createUserDto: (body = {}) => ({
    fullName: body.fullName,
    email: body.email,
    phoneNumber: body.phoneNumber,
    role: body.role,
    journeyIds: body.journeyIds || [],
    stationIds: body.stationIds || [],
  }),
  updateUserDto: (body = {}) => ({
    fullName: body.fullName,
    email: body.email,
    phoneNumber: body.phoneNumber,
  }),
};
