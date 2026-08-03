export const COACH_CLASSES = {
  FIRST_CLASS: 'FIRST_CLASS',
  SECOND_CLASS: 'SECOND_CLASS',
  THIRD_CLASS: 'THIRD_CLASS',
} as const;
export type CoachClass = (typeof COACH_CLASSES)[keyof typeof COACH_CLASSES];
