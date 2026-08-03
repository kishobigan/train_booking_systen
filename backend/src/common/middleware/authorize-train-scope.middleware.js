'use strict';
const asyncHandler=require('../utils/async-handler');
module.exports=(scope)=>({
 authorizeTrainParam:(param='trainId')=>asyncHandler(async(req,res,next)=>{void res;await scope.assertTrainAccess(req.user,req.params[param]);next();}),
 authorizeJourneyTrainScope:(param='journeyId')=>asyncHandler(async(req,res,next)=>{void res;await scope.assertJourneyAccess(req.user,req.params[param]);next();}),
 authorizeBookingTrainScope:(param='bookingId')=>asyncHandler(async(req,res,next)=>{void res;await scope.assertBookingAccess(req.user,req.params[param]);next();}),
 authorizePaymentTrainScope:(param='paymentId')=>asyncHandler(async(req,res,next)=>{void res;await scope.assertPaymentAccess(req.user,req.params[param]);next();}),
 authorizeWaitlistTrainScope:(param='waitlistEntryId')=>asyncHandler(async(req,res,next)=>{void res;await scope.assertWaitlistAccess(req.user,req.params[param]);next();}),
});
