'use strict';
const AuthorizationError=require('../../common/errors/AuthorizationError');
const ROLES=require('../../common/constants/roles.constants');
class TrainScopeAuthorizationService{
 constructor({assignmentRepository,models}){this.assignmentRepository=assignmentRepository;this.models=models||require('../../models');}
 getAccessibleTrainIds(actor,options={}){if(actor?.role===ROLES.SUPER_ADMIN)return Promise.resolve(null);if(actor?.role!==ROLES.ADMIN)return Promise.resolve([]);return this.assignmentRepository.findAssignedTrainIds(actor.id,options);}
 async canAccessTrain(actor,trainId,options={}){if(actor?.role===ROLES.SUPER_ADMIN)return true;if(actor?.role!==ROLES.ADMIN)return false;return this.assignmentRepository.isAdminAssignedToTrain(actor.id,trainId,options);}
 async assertTrainAccess(actor,trainId,options={}){if(!await this.canAccessTrain(actor,trainId,options))throw new AuthorizationError('This train has not been assigned to your account.',{code:'TRAIN_ACCESS_DENIED',trainId});return true;}
 async resolveJourneyTrain(journeyId,options={}){const row=await this.models.Journey.findByPk(journeyId,{...options,attributes:['trainId']});return row?.trainId;}
 async resolveBookingTrain(bookingId,options={}){const row=await this.models.Booking.findByPk(bookingId,{...options,include:[{model:this.models.Journey,as:'journey',attributes:['trainId']} ]});return row?.journey?.trainId;}
 async resolvePaymentTrain(paymentId,options={}){const row=await this.models.Payment.findByPk(paymentId,{...options,include:[{model:this.models.Booking,as:'booking',attributes:['id'],include:[{model:this.models.Journey,as:'journey',attributes:['trainId']}]}]});return row?.booking?.journey?.trainId;}
 async resolveWaitlistTrain(id,options={}){const row=await this.models.WaitlistEntry.findByPk(id,{...options,include:[{model:this.models.Journey,as:'journey',attributes:['trainId']}]});return row?.journey?.trainId;}
 async assertJourneyAccess(actor,id,options={}){return this.assertTrainAccess(actor,await this.resolveJourneyTrain(id,options),options);}
 async assertBookingAccess(actor,id,options={}){return this.assertTrainAccess(actor,await this.resolveBookingTrain(id,options),options);}
 async assertPaymentAccess(actor,id,options={}){return this.assertTrainAccess(actor,await this.resolvePaymentTrain(id,options),options);}
 async assertWaitlistAccess(actor,id,options={}){return this.assertTrainAccess(actor,await this.resolveWaitlistTrain(id,options),options);}
 canManageTrain(...args){return this.canAccessTrain(...args)} canCreateJourneyForTrain(...args){return this.canAccessTrain(...args)} canAccessJourney(...args){return this.assertJourneyAccess(...args)} canAccessBooking(...args){return this.assertBookingAccess(...args)} canAccessPayment(...args){return this.assertPaymentAccess(...args)} canAccessWaitlist(...args){return this.assertWaitlistAccess(...args)} canAccessSeatMap(...args){return this.assertJourneyAccess(...args)} canAccessRevenue(...args){return this.canAccessTrain(...args)} canAccessOccupancy(...args){return this.canAccessTrain(...args)}
}
module.exports=TrainScopeAuthorizationService;
