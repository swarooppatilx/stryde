export type MotionState = 'unknown' | 'moving' | 'still';

interface DetectorOptions {
  /** Time constant of the quick average: how fast a stop is noticed. */
  fastTauMs?: number;
  /** Time constant of the slow average: what "normal movement" has been lately. */
  slowTauMs?: number;
  /** Below this much motion (in g) the phone counts as still, whatever the slow average says. */
  stillFloorG?: number;
  /** Above this much motion (in g) can the phone count as moving again. */
  moveFloorG?: number;
  /** No verdict until this much time has passed since the first sample. */
  warmupMs?: number;
}

/**
 * Tells moving from still using two running averages of how far the acceleration strays from gravity:
 * a quick one (0.4 s) and a slow one (10 s). Stopped when the quick average falls under a third of the slow
 * one (or under a small floor); moving again when it climbs back over half the level from just before the stop,
 * or over three times the slow average if that is lower (and always over a floor, so sensor noise cannot wake it). Needs no knowledge of how the phone is carried.
 */
export function createMotionDetector({
  fastTauMs = 400,
  slowTauMs = 10_000,
  stillFloorG = 0.03,
  moveFloorG = 0.08,
  warmupMs = 3_000,
}: DetectorOptions = {}) {
  let fast = 0;
  let slow = 0;
  let lastAt: number | null = null;
  let firstAt: number | null = null;
  let state: MotionState = 'unknown';
  /** How much movement there was just before the stop: what "moving again" is measured against. */
  let baseline = 0;

  return {
    update(magnitudeG: number, atMs: number): MotionState {
      const energy = Math.abs(magnitudeG - 1);
      if (lastAt === null || firstAt === null) {
        fast = energy;
        slow = energy;
        firstAt = atMs;
      } else {
        const dt = Math.max(0, atMs - lastAt);
        fast += (1 - Math.exp(-dt / fastTauMs)) * (energy - fast);
        slow += (1 - Math.exp(-dt / slowTauMs)) * (energy - slow);
      }
      lastAt = atMs;

      if (atMs - firstAt < warmupMs) return 'unknown';

      if (state !== 'still') {
        if (fast < stillFloorG || fast < slow / 3) {
          state = 'still';
          baseline = slow;
        } else {
          state = 'moving';
        }
      } else if (fast > Math.max(moveFloorG, Math.min(slow * 3, baseline / 2))) {
        // Over half of what the athlete was doing before, or well over what the phone has felt since.
        state = 'moving';
      }
      return state;
    },
    reset() {
      fast = 0;
      slow = 0;
      lastAt = null;
      firstAt = null;
      state = 'unknown';
      baseline = 0;
    },
  };
}
