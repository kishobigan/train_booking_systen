export type Role = 'PASSENGER' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';
export interface User { id: string; email: string; fullName: string; role: Role; mustChangePassword?: boolean }
export interface Station { id: string; code: string; name: string; city?: string }
export interface Journey { id: string; journeyNumber?: string; status: string; departureTime: string; arrivalTime?: string; train?: { name?: string; number?: string } }
export interface SeatMapSnapshot { version: string | number; journeyId: string; coaches?: Array<{ id: string; name?: string; seats?: Array<Record<string, unknown>> }>; [key: string]: unknown }
export interface Paginated<T> { items: T[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }
