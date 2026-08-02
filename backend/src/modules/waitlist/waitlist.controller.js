'use strict';

const asyncHandler = require('../../common/utils/async-handler');
const apiResponse = require('../../common/utils/api-response');
const { joinWaitlistDto, acceptOfferDto } = require('./waitlist.dto');
const { validateJoin, validateAccept, validateOffer } = require('./waitlist.validator');

class WaitlistController {
  constructor({ waitlistService }) {
    this.service = waitlistService;
  }
  join = asyncHandler(async (req, res) => {
    const result = await this.service.joinWaitlist({
      userId: req.user.id,
      ...validateJoin(joinWaitlistDto(req.body)),
    });
    res.status(201).json(apiResponse.success(result));
  });
  listMine = asyncHandler(async (req, res) => {
    res.status(200).json(apiResponse.success(await this.service.getUserWaitlist(req.user.id)));
  });
  get = asyncHandler(async (req, res) => {
    const result = await this.service.getWaitlistEntry({
      waitlistEntryId: req.params.waitlistEntryId,
      userId: req.user.id,
      actor: req.user,
    });
    res.status(200).json(apiResponse.success(result));
  });
  position = asyncHandler(async (req, res) => {
    const result = await this.service.getWaitlistPosition({
      waitlistEntryId: req.params.waitlistEntryId,
      userId: req.user.id,
    });
    res.status(200).json(apiResponse.success(result));
  });
  leave = asyncHandler(async (req, res) => {
    const result = await this.service.leaveWaitlist({
      waitlistEntryId: req.params.waitlistEntryId,
      userId: req.user.id,
      reason: req.body?.reason,
    });
    res.status(200).json(apiResponse.success(result));
  });
  accept = asyncHandler(async (req, res) => {
    const result = await this.service.acceptOffer({
      waitlistEntryId: req.params.waitlistEntryId,
      userId: req.user.id,
      idempotencyKey: req.get('Idempotency-Key'),
      ...validateAccept(acceptOfferDto(req.body)),
    });
    res.status(201).json(apiResponse.success(result));
  });
  listJourney = asyncHandler(async (req, res) => {
    const result = await this.service.getJourneyWaitlist(req.params.journeyId, req.user);
    res.status(200).json(apiResponse.success(result));
  });
  offer = asyncHandler(async (req, res) => {
    const result = await this.service.offerSeat(
      validateOffer({
        waitlistEntryId: req.params.waitlistEntryId,
        journeySeatId: req.body.journeySeatId,
        journeySeatIds: req.body.journeySeatIds,
        actor: req.user,
      })
    );
    res.status(200).json(apiResponse.success(result));
  });
  expire = asyncHandler(async (req, res) => {
    const result = await this.service.expireOffer({
      waitlistEntryId: req.params.waitlistEntryId,
      actor: req.user,
      reason: req.body?.reason,
    });
    res.status(200).json(apiResponse.success(result));
  });
}

module.exports = WaitlistController;
