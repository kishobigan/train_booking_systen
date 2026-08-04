'use client';
import { create } from 'zustand';

interface GuestBookingAccessState {
  requestId: string | null;
  bookingId: string | null;
  expiresAt: string | null;
  verified: boolean;
  setRequest: (input: { requestId: string }) => void;
  setVerified: (input: { bookingId: string; expiresAt: string }) => void;
  clear: () => void;
}

export const useGuestBookingAccessStore = create<GuestBookingAccessState>((set) => ({
  requestId: null,
  bookingId: null,
  expiresAt: null,
  verified: false,
  setRequest: ({ requestId }) => set({ requestId }),
  setVerified: ({ bookingId, expiresAt }) => set({ bookingId, expiresAt, verified: true }),
  clear: () => set({ requestId: null, bookingId: null, expiresAt: null, verified: false }),
}));