'use client';
import { create } from 'zustand';
type Passenger = { fullName: string; identityNumber?: string };
interface BookingDraft { journeyId?: string; originStationId?: string; destinationStationId?: string; passengers: Passenger[]; setRoute: (value: Partial<BookingDraft>) => void; setPassengers: (value: Passenger[]) => void; clear: () => void }
const initial = { passengers: [] as Passenger[] };
export const useBookingDraftStore = create<BookingDraft>((set) => ({ ...initial, setRoute: (value) => set(value), setPassengers: (passengers) => set({ passengers }), clear: () => set(initial) }));
