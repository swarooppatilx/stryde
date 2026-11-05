/** Durations in ms that animated surfaces draw from. */
export const Motion = {
  fast: 200,
  standard: 400,
  slide: 300,
} as const;

/** Springs for things that settle: a sheet snapping, a section opening. Shared so they all feel alike. */
export const Springs = {
  /** Sheets and expanding sections. */
  sheet: { damping: 22, stiffness: 200 },
  /** A photo settling back after a pinch or drag; a touch stiffer than a sheet. */
  photo: { damping: 22, stiffness: 220 },
} as const;
