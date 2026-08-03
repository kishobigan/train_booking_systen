'use client';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '@/constants/query-keys';
import {adminUserService} from '@/services/admin/user.service';
import {useAdminContext} from './useAdminContext';
import {apiClient} from '@/services/http/api-client';
import {unwrap} from '@/services/http/api-response';
export function useUsers(params:Record<string,unknown>={}){const {isSuperAdmin}=useAdminContext();return useQuery({queryKey:queryKeys.users.list(params),queryFn:async()=>isSuperAdmin?unwrap<any>((await apiClient.get('/super-admin/manage/users',{params})).data):adminUserService.list(false,params)})}
export function useCreateUser(){const {isSuperAdmin}=useAdminContext(),client=useQueryClient();return useMutation({mutationFn:(input:unknown)=>adminUserService.create(isSuperAdmin,input),onSuccess:()=>client.invalidateQueries({queryKey:['users']})})}
