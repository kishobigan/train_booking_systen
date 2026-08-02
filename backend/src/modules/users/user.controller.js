'use strict';
const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { createUserDto, updateUserDto } = require('./user.dto');
const { validateCreate } = require('./user.validator');
class UserController {
  constructor({ userService, accessControlService }) {
    Object.assign(this, { userService, accessControlService });
  }
  createUser = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.userService.createUser({
          actor: req.user,
          ...validateCreate(createUserDto(req.body)),
        })
      )
    )
  );
  createStaff = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.userService.createStaff({
          actor: req.user,
          ...validateCreate(createUserDto({ ...req.body, role: 'STAFF' })),
        })
      )
    )
  );
  list = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.userService.getUsers(req.query)))
  );
  listStaff = asyncHandler(async (req, res) =>
    res.json(apiResponse.success(await this.userService.getManagedStaff(req.user, req.query)))
  );
  get = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.userService.getUserById(req.params.userId || req.params.staffId, req.user)
      )
    )
  );
  update = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.userService.updateUser({
          actor: req.user,
          targetUserId: req.params.userId || req.params.staffId,
          values: updateUserDto(req.body),
        })
      )
    )
  );
  block = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.userService.blockUser({
          actor: req.user,
          targetUserId: req.params.userId || req.params.staffId,
          reason: req.body.reason,
        })
      )
    )
  );
  unblock = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.userService.unblockUser({
          actor: req.user,
          targetUserId: req.params.userId || req.params.staffId,
        })
      )
    )
  );
  resetPassword = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.userService.resetUserPassword({
          actor: req.user,
          targetUserId: req.params.userId || req.params.staffId,
        })
      )
    )
  );
  assignRole = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.userService.assignRole({
          actor: req.user,
          targetUserId: req.params.userId,
          role: req.body.role,
        })
      )
    )
  );
  assignJourney = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.accessControlService.assignAdminToJourney({
          actor: req.user,
          adminUserId: req.params.adminId,
          journeyId: req.body.journeyId,
        })
      )
    )
  );
  listJourneys = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(await this.accessControlService.getAdminJourneys(req.params.adminId))
    )
  );
  removeJourney = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.accessControlService.removeAdminFromJourney({
          actor: req.user,
          adminUserId: req.params.adminId,
          journeyId: req.params.journeyId,
        })
      )
    )
  );
  assignStation = asyncHandler(async (req, res) =>
    res.status(201).json(
      apiResponse.success(
        await this.accessControlService.assignStaffToStation({
          actor: req.user,
          staffUserId: req.params.staffId,
          stationId: req.body.stationId,
        })
      )
    )
  );
  listStations = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(await this.accessControlService.getStaffStations(req.params.staffId))
    )
  );
  removeStation = asyncHandler(async (req, res) =>
    res.json(
      apiResponse.success(
        await this.accessControlService.removeStaffFromStation({
          actor: req.user,
          staffUserId: req.params.staffId,
          stationId: req.params.stationId,
        })
      )
    )
  );
}
module.exports = UserController;
