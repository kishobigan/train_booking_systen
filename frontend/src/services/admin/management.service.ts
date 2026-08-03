import { apiClient } from '@/services/http/api-client';
import { unwrap } from '@/services/http/api-response';
import { useAuthStore } from '@/store/auth.store';

export type Pagination = { page:number; limit:number; totalItems:number; totalPages:number; hasNextPage:boolean; hasPreviousPage:boolean };
export type PageResult<T> = { items:T[]; pagination:Pagination };
const base = () => {
  const role = useAuthStore.getState().user?.role;
  if (role === 'STAFF') return '/staff/manage';
  if (role === 'ADMIN') return '/admin/manage';
  return '/super-admin/manage';
};
const list = async <T>(resource:string, params:Record<string,unknown>={}) => unwrap<PageResult<T>>((await apiClient.get(`${base()}/${resource}`, { params })).data);
const get = async <T>(resource:string, id:string) => unwrap<T>((await apiClient.get(`${base()}/${resource}/${id}`)).data);
const create = async <T>(resource:string, input:unknown) => unwrap<T>((await apiClient.post(`${base()}/${resource}`, input)).data);
const update = async <T>(resource:string, id:string, input:unknown) => unwrap<T>((await apiClient.patch(`${base()}/${resource}/${id}`, input)).data);
const action = async <T>(resource:string, id:string, name:string, input:unknown={}) => unwrap<T>((await apiClient.post(`${base()}/${resource}/${id}/${name}`, input)).data);

export const trainManagementService = { list:(p?:Record<string,unknown>)=>list<any>('trains',p), get:(id:string)=>get<any>('trains',id), create:(v:unknown)=>create<any>('trains',v), update:(id:string,v:unknown)=>update<any>('trains',id,v), action:(id:string,name:string,v?:unknown)=>action<any>('trains',id,name,v) };
export const stationManagementService = { list:(p?:Record<string,unknown>)=>list<any>('stations',p), get:(id:string)=>get<any>('stations',id), create:(v:unknown)=>create<any>('stations',v), update:(id:string,v:unknown)=>update<any>('stations',id,v), action:(id:string,name:string)=>action<any>('stations',id,name) };
export const routeManagementService = { list:(p?:Record<string,unknown>)=>list<any>('routes',p), get:(id:string)=>get<any>('routes',id), create:(v:unknown)=>create<any>('routes',v), update:(id:string,v:unknown)=>update<any>('routes',id,v), action:(id:string,name:string)=>action<any>('routes',id,name) };
export const journeyManagementService = { list:(p?:Record<string,unknown>)=>list<any>('journeys',p), get:(id:string)=>get<any>('journeys',id), create:(v:unknown)=>create<any>('journeys',v), update:(id:string,v:unknown)=>update<any>('journeys',id,v), action:(id:string,name:string,v?:unknown)=>action<any>('journeys',id,name,v) };
export const bookingManagementService = { list:(p?:Record<string,unknown>)=>list<any>('bookings',p), get:(id:string)=>get<any>('bookings',id), action:(id:string,name:string,v?:unknown)=>action<any>('bookings',id,name,v) };
export const paymentManagementService = { list:(p?:Record<string,unknown>)=>list<any>('payments',p), get:(id:string)=>get<any>('payments',id) };
export const waitlistManagementService = { list:(p?:Record<string,unknown>)=>list<any>('waitlist',p), get:(id:string)=>get<any>('waitlist',id), action:(id:string,name:string,v?:unknown)=>action<any>('waitlist',id,name,v) };
export const auditManagementService = { list:(p?:Record<string,unknown>)=>list<any>('audit-logs',p), get:(id:string)=>get<any>('audit-logs',id) };
