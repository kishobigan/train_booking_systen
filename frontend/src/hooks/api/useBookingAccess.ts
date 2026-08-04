'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { bookingAccessService } from '@/services/booking-access.service';

export function useBookingAccessRequest() {
  return useMutation({ mutationFn: (input: Record<string, unknown>) => bookingAccessService.requestBookingAccess(input) });
}

export function useBookingAccessOtpVerification() {
  return useMutation({ mutationFn: (input: Record<string, unknown>) => bookingAccessService.verifyBookingAccessOtp(input) });
}

export function useCustomerActivity(enabled = false) {
  return useQuery({
    queryKey: queryKeys.guestAccess.summary,
    queryFn: () => bookingAccessService.getCustomerActivity(),
    enabled,
  });
}

export function useGuestBookings(enabled = false) {
  return useCustomerActivity(enabled);
}

export function useGuestWaitlist(enabled = false) {
  return useCustomerActivity(enabled);
}

export function useGuestPaymentStatus(enabled = false) {
  return useCustomerActivity(enabled);
}