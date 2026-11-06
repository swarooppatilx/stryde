export interface HeartRateSample {
  /** Unix epoch milliseconds. */
  timestamp: number;
  bpm: number;
}

export interface SweatInput {
  samples: HeartRateSample[];
  activityStart: number;
  activityEnd: number;
  /** Resting heart rate if the wearable reports one; otherwise a population default is used. */
  restingBpm?: number;
  distanceM: number;
}

export interface SweatResult {
  /** 0-100. How strongly the heart-rate trace supports a human effort for this activity. */
  score: number;
  avgBpm: number;
  maxBpm: number;
  sampleCount: number;
  /** Share of the activity window covered by heart-rate samples. */
  coverage: number;
  verified: boolean;
  reason: string;
}

const DEFAULT_RESTING_BPM = 65;
/** Minimum average lift over resting for an effort to count as "sweat-verified". */
const MIN_LIFT_BPM = 20;
const MIN_COVERAGE = 0.5;
const MIN_SAMPLES = 5;
const SAMPLE_GAP_MS = 60_000;

/**
 * Proof-of-sweat heuristic: a run recorded from a car or a GPS spoofer shows
 * no sustained heart-rate lift. Not a cryptographic proof — it raises the
 * cost of cheating and is surfaced as a signal next to World ID verification.
 */
export function computeSweatScore(input: SweatInput): SweatResult {
  const window = input.samples
    .filter(
      (s) =>
        s.timestamp >= input.activityStart &&
        s.timestamp <= input.activityEnd &&
        Number.isFinite(s.bpm) &&
        s.bpm > 25 &&
        s.bpm < 240
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const durationMs = Math.max(1, input.activityEnd - input.activityStart);
  const resting = input.restingBpm ?? DEFAULT_RESTING_BPM;

  if (window.length < MIN_SAMPLES) {
    return {
      score: 0,
      avgBpm: 0,
      maxBpm: 0,
      sampleCount: window.length,
      coverage: 0,
      verified: false,
      reason: 'Not enough heart-rate samples from a wearable during this activity.',
    };
  }

  let coveredMs = 0;
  for (let i = 1; i < window.length; i++) {
    const current = window[i];
    const previous = window[i - 1];
    if (current && previous) {
      coveredMs += Math.min(SAMPLE_GAP_MS, current.timestamp - previous.timestamp);
    }
  }
  const coverage = Math.min(1, coveredMs / durationMs);

  const avgBpm = window.reduce((sum, s) => sum + s.bpm, 0) / window.length;
  const maxBpm = window.reduce((max, s) => Math.max(max, s.bpm), 0);
  const lift = avgBpm - resting;

  const liftScore = Math.max(0, Math.min(1, lift / 60));
  const score = Math.round(100 * (0.7 * liftScore + 0.3 * coverage));
  const verified = lift >= MIN_LIFT_BPM && coverage >= MIN_COVERAGE && input.distanceM > 0;

  let reason = 'Heart rate confirms a sustained physical effort.';
  if (lift < MIN_LIFT_BPM) {
    reason = `Average heart rate only ${Math.round(lift)} bpm above resting — not consistent with this effort.`;
  } else if (coverage < MIN_COVERAGE) {
    reason = 'Wearable data covers less than half of the activity.';
  }

  return {
    score,
    avgBpm: Math.round(avgBpm),
    maxBpm: Math.round(maxBpm),
    sampleCount: window.length,
    coverage: Math.round(coverage * 100) / 100,
    verified,
    reason,
  };
}
