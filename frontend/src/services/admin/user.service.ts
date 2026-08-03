import {apiClient} from '@/services/http/api-client';
import {unwrap} from '@/services/http/api-response';
export const adminUserService={
 list:async(superAdmin:boolean,params?:Record<string,unknown>)=>unwrap<any[]>((await apiClient.get(superAdmin?'/super-admin/users':'/admin/staff',{params})).data),
 get:async(superAdmin:boolean,id:string)=>unwrap<Record<string,any>>((await apiClient.get(superAdmin?`/super-admin/users/${id}`:`/admin/staff/${id}`)).data),
 create:async(superAdmin:boolean,input:unknown)=>unwrap<Record<string,any>>((await apiClient.post(superAdmin?'/super-admin/users':'/admin/staff',input)).data),
 block:async(superAdmin:boolean,id:string,reason:string)=>unwrap((await apiClient.post(superAdmin?`/super-admin/users/${id}/block`:`/admin/staff/${id}/block`,{reason})).data),
 unblock:async(superAdmin:boolean,id:string)=>unwrap((await apiClient.post(superAdmin?`/super-admin/users/${id}/unblock`:`/admin/staff/${id}/unblock`)).data),
 resetPassword:async(superAdmin:boolean,id:string)=>unwrap<Record<string,any>>((await apiClient.post(superAdmin?`/super-admin/users/${id}/reset-password`:`/admin/staff/${id}/reset-password`)).data),
 assignedTrains:async(id:string)=>unwrap<any[]>((await apiClient.get(`/super-admin/manage/admins/${id}/trains`)).data),
 assignTrains:async(id:string,trainIds:string[])=>unwrap<any[]>((await apiClient.post(`/super-admin/manage/admins/${id}/trains`,{trainIds})).data),
 revokeTrain:async(id:string,trainId:string,reason:string)=>unwrap((await apiClient.delete(`/super-admin/manage/admins/${id}/trains/${trainId}`,{data:{reason}})).data),
 assignmentHistory:async(id:string)=>unwrap<any[]>((await apiClient.get(`/super-admin/manage/admins/${id}/train-assignment-history`)).data),
 assignedStations:async(id:string)=>unwrap<any[]>((await apiClient.get(`/super-admin/manage/staff/${id}/stations`)).data),
 assignStations:async(id:string,stationIds:string[])=>unwrap<any[]>((await apiClient.post(`/super-admin/manage/staff/${id}/stations`,{stationIds})).data),
 revokeStation:async(id:string,stationId:string,reason:string)=>unwrap((await apiClient.delete(`/super-admin/manage/staff/${id}/stations/${stationId}`,{data:{reason}})).data),
 stationAssignmentHistory:async(id:string)=>unwrap<any[]>((await apiClient.get(`/super-admin/manage/staff/${id}/station-assignment-history`)).data),
};
