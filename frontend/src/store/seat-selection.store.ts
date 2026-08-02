'use client';
import { create } from 'zustand';
interface SeatSelectionState { journeyId: string | null; seatIds: string[]; reset: (journeyId?: string) => void; toggle: (seatId: string, maximum?: number) => void }
export const useSeatSelectionStore = create<SeatSelectionState>((set) => ({
  journeyId: null, seatIds: [],
  reset: (journeyId) => set({ journeyId: journeyId ?? null, seatIds: [] }),
  toggle: (seatId, maximum = 6) => set((state) => state.seatIds.includes(seatId)
    ? { seatIds: state.seatIds.filter((id) => id !== seatId) }
    : state.seatIds.length < maximum ? { seatIds: [...state.seatIds, seatId] } : state),
}));
