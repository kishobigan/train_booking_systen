import { ApiError } from './api-error';
export function unwrapResponse<T>(body: { success?: boolean; data?: T; error?: { message?: string; code?: string } }): T { if (!body?.success || body.data === undefined) throw new ApiError({ message: body?.error?.message || 'The server returned an invalid response.', code: body?.error?.code || 'CLIENT_RESPONSE_INVALID' }); return body.data; }
export const unwrap = unwrapResponse;
