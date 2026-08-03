'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const AuthorizationError=require('../../../src/common/errors/AuthorizationError');
const TrainScopeAuthorizationService=require('../../../src/modules/access-control/train-scope-authorization.service');
const service=new TrainScopeAuthorizationService({assignmentRepository:{findAssignedTrainIds:async id=>id==='admin-1'?['train-1']:[],isAdminAssignedToTrain:async(id,trainId)=>id==='admin-1'&&trainId==='train-1'},models:{}});
test('Super Admin accesses any train and Admin only an active assigned train',async()=>{assert.equal(await service.canAccessTrain({role:'SUPER_ADMIN'},'anything'),true);assert.equal(await service.canAccessTrain({id:'admin-1',role:'ADMIN'},'train-1'),true);assert.equal(await service.canAccessTrain({id:'admin-1',role:'ADMIN'},'train-2'),false);await assert.rejects(()=>service.assertTrainAccess({id:'admin-1',role:'ADMIN'},'train-2'),AuthorizationError);});
test('Staff receives no train-management scope',async()=>{assert.deepEqual(await service.getAccessibleTrainIds({id:'staff-1',role:'STAFF'}),[]);assert.equal(await service.canAccessTrain({id:'staff-1',role:'STAFF'},'train-1'),false);});
