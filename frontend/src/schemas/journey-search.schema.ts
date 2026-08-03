import { z } from 'zod';
import { COACH_CLASSES } from '@/constants/coach-classes';
const uuid = z.string().uuid('Select a valid station.');
const coachClasses = Object.values(COACH_CLASSES) as [string, ...string[]];
export const journeySearchSchema = z
  .object({
    originStationId: uuid,
    destinationStationId: uuid,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a travel date.'),
    passengerCount: z.coerce.number().int().min(1).max(6),
    coachClass: z.enum(coachClasses).or(z.literal('')).optional(),
  })
  .refine((v) => v.originStationId !== v.destinationStationId, {
    message: 'Origin and destination must be different.',
    path: ['destinationStationId'],
  });
export type JourneySearchValues = z.infer<typeof journeySearchSchema>;
