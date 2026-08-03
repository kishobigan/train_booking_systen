'use strict';
const {StaffStation,Station,User}=require('../../models');
const BaseRepository=require('../../common/repositories/BaseRepository');
const include=[{model:User,as:'staff',attributes:['id','fullName','email','role']},{model:Station,as:'station',attributes:['id','code','name','isActive']},{model:User,as:'assignedBy',attributes:['id','fullName']},{model:User,as:'revokedBy',attributes:['id','fullName'],required:false}];
class StaffStationRepository extends BaseRepository{
 constructor(){super(StaffStation)}
 findActiveAssignment(staffUserId,stationId,options={}){return this.findOne({staffUserId,stationId,isActive:true},{...options,include})}
 findActive(staffUserId,stationId,options={}){return this.findActiveAssignment(staffUserId,stationId,options)}
 findStaffStationAssignments(staffUserId,options={}){return this.model.findAll({...options,where:{staffUserId,isActive:true},include,order:[['assignedAt','DESC']]})}
 list(staffUserId,options={}){return this.findStaffStationAssignments(staffUserId,options)}
 findStationStaffAssignments(stationId,options={}){return this.model.findAll({...options,where:{stationId,isActive:true},include,order:[['assignedAt','DESC']]})}
 async findAssignedStationIds(staffUserId,options={}){const rows=await this.model.findAll({...options,where:{staffUserId,isActive:true},attributes:['stationId'],raw:true});return rows.map(row=>row.stationId)}
 async isStaffAssignedToStation(staffUserId,stationId,options={}){return Boolean(await this.findActiveAssignment(staffUserId,stationId,options))}
 assignStation(values,options={}){return this.create({...values,isActive:true},options)}
 findLatest(staffUserId,stationId,options={}){return this.model.findOne({...options,where:{staffUserId,stationId},include,order:[['createdAt','DESC']]})}
 async revokeStation(staffUserId,stationId,values,options={}){const row=await this.findActiveAssignment(staffUserId,stationId,options);if(!row)return null;return row.update({isActive:false,revokedAt:new Date(),...values},options)}
 remove(staffUserId,stationId,options={}){return this.revokeStation(staffUserId,stationId,{},options)}
 revokeAllStaffStations(staffUserId,values,options={}){return this.model.update({isActive:false,revokedAt:new Date(),...values},{...options,where:{staffUserId,isActive:true}})}
 restoreAssignment(row,values,options={}){return row.update({isActive:true,assignedAt:new Date(),revokedAt:null,revokedByUserId:null,revocationReason:null,...values},options)}
 getAssignmentHistory(staffUserId,options={}){return this.model.findAll({...options,where:{staffUserId},include,order:[['createdAt','DESC']]})}
 upsert(values,options={}){return this.findActiveAssignment(values.staffUserId,values.stationId,options).then(async active=>{if(active)return active;const latest=await this.findLatest(values.staffUserId,values.stationId,options);return latest?this.restoreAssignment(latest,values,options):this.assignStation(values,options)})}
}
module.exports=StaffStationRepository;
