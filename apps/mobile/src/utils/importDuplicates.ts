/** Starts this close (ms) are the same moment: clocks on a watch and a phone differ a little. */
const SAME_START_MS = 60_000;
/** Distances within this fraction of each other are the same effort measured twice. */
const SAME_DISTANCE = 0.1;

export interface ImportCandidate {
  /** When it began, in ms. */
  startedAt: number;
  distance: number;
}

export interface OwnActivity {
  /** When it began (recordings) or was saved (older ones): both readings are tried. */
  createdAt: Date | number;
  duration: number;
  distance: number;
}

/** Whether an activity already on this phone looks like the same one: same start time, similar distance. */
export function isDuplicateActivity(
  candidate: ImportCandidate,
  own: readonly OwnActivity[]
): boolean {
  return own.some((activity) => {
    const at = new Date(activity.createdAt).getTime();
    const similar =
      Math.abs(activity.distance - candidate.distance) <=
      SAME_DISTANCE * Math.max(activity.distance, candidate.distance);
    return (
      similar &&
      [at, at - activity.duration].some(
        (start) => Math.abs(start - candidate.startedAt) <= SAME_START_MS
      )
    );
  });
}
