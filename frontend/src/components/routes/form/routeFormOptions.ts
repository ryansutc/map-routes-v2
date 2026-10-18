/** Route form choices shared by create and edit experiences. */
export const ACTIVITY_TYPES = [
  "Hiking",
  "Running",
  "Cycling",
  "Backpacking",
  "Skiing",
  "Other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
