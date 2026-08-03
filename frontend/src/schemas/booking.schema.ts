import { z } from 'zod';
export const passengerSchema = z
  .object({
    passengerNumber: z.number().int().positive(),
    fullName: z.string().trim().min(2).max(150),
    passengerType: z.enum(['ADULT', 'CHILD', 'SENIOR', 'STUDENT', 'DISABLED']),
    identityType: z.enum(['NIC', 'PASSPORT', 'DEPENDENT']),
    identityNumber: z.string().max(80).optional(),
    identityCountry: z.string().length(3).optional(),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    guardianPassengerNumber: z.number().int().positive().optional(),
    guardianRelationship: z.string().max(50).optional(),
    journeySeatId: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.identityType !== 'DEPENDENT' && !value.identityNumber?.trim())
      context.addIssue({
        code: 'custom',
        path: ['identityNumber'],
        message: 'Identity number is required',
      });
    if (value.identityType === 'DEPENDENT' && !value.guardianPassengerNumber)
      context.addIssue({
        code: 'custom',
        path: ['guardianPassengerNumber'],
        message: 'Select a guardian',
      });
  });
export const bookingSchema = z
  .object({
    passengers: z.array(passengerSchema).min(1).max(6),
    contact: z.object({
      fullName: z.string().trim().min(2).max(150),
      email: z.string().email().or(z.literal('')),
      phone: z.string().max(30).optional(),
    }),
    policyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Accept the booking policy to continue.' }),
    }),
  })
  .refine((value) => Boolean(value.contact.email || value.contact.phone), {
    message: 'Enter an email address or phone number.',
    path: ['contact', 'email'],
  });
export type BookingFormValues = z.infer<typeof bookingSchema>;
