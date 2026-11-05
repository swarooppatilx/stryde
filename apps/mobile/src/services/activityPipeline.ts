import { useActivityStore } from '@/stores/activityStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { type MatchResult, matchActivity, type TimedPoint } from './arkivService';
import { readActivityHealthData } from './healthService';

interface RecordedSession {
  track: TimedPoint[];
  startedAt: number;
  endedAt: number;
}

const MAX_TRACK_POINTS = 5_000;
const MAX_KEPT_SESSIONS = 5;
/** Watches sync to the phone's health hub in batches; widen the window a little. */
const HEALTH_WINDOW_PAD_MS = 60_000;

let pendingSession: RecordedSession | null = null;
const sessionsByActivity = new Map<string, RecordedSession>();

function downsample(track: TimedPoint[]): TimedPoint[] {
  if (track.length <= MAX_TRACK_POINTS) return track;
  const stride = Math.ceil(track.length / MAX_TRACK_POINTS);
  const out = track.filter((_, i) => i % stride === 0);
  const last = track[track.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Called by the tracking screen when a recording finishes. */
export function setFinishedSession(track: TimedPoint[]): void {
  if (track.length < 2) {
    pendingSession = null;
    return;
  }
  const sorted = [...track].sort((a, b) => a.timestamp - b.timestamp);
  pendingSession = {
    track: downsample(sorted),
    startedAt: sorted[0]!.timestamp,
    endedAt: sorted[sorted.length - 1]!.timestamp,
  };
}

/** Binds the most recent recording to the activity it was saved as. */
export function attachSessionToActivity(activityId: string): boolean {
  if (!pendingSession) return false;
  sessionsByActivity.set(activityId, pendingSession);
  pendingSession = null;
  while (sessionsByActivity.size > MAX_KEPT_SESSIONS) {
    const oldest = sessionsByActivity.keys().next().value;
    if (oldest === undefined) break;
    sessionsByActivity.delete(oldest);
  }
  return true;
}

export function hasSessionForActivity(activityId: string): boolean {
  return sessionsByActivity.has(activityId);
}

/**
 * Reads the wearable heart-rate trace for the activity window and asks the API
 * to score it, archive the GPX on Swarm and match Arkiv segments. Results are
 * stored on the local activity. Never throws.
 */
export async function runPostActivityPipeline(input: {
  activityId: string;
  onchainActivityId?: string;
  name: string;
  distance: number;
  athlete: string;
  /** Re-check wearable data only; segments and Swarm were handled on the first run. */
  scoreOnly?: boolean;
}): Promise<MatchResult | null> {
  const session = sessionsByActivity.get(input.activityId);
  if (!session) return null;
  const scoreOnly = Boolean(input.scoreOnly);
  const { healthData, privateRoutes } = useSettingsStore.getState();

  const health = healthData
    ? await readActivityHealthData(
        new Date(session.startedAt - HEALTH_WINDOW_PAD_MS),
        new Date(session.endedAt + HEALTH_WINDOW_PAD_MS)
      )
    : null;

  try {
    const result = await matchActivity({
      athlete: input.athlete,
      activityId: Number(input.onchainActivityId ?? 0),
      name: input.name,
      distanceM: input.distance,
      track: session.track,
      heartRate: health?.samples.length ? { samples: health.samples, restingBpm: health.restingBpm } : undefined,
      privateRoute: privateRoutes,
      scoreOnly,
    });
    useActivityStore.getState().updateActivity(input.activityId, {
      ...(result.sweat.sampleCount > 0 ? { sweat: result.sweat } : {}),
      ...(health?.steps ? { steps: health.steps } : {}),
      ...(scoreOnly
        ? {}
        : {
            segmentEfforts: result.efforts.map(({ key, segmentKey, segmentName, elapsedSec }) => ({
              key,
              segmentKey,
              segmentName,
              elapsedSec,
            })),
          }),
      ...(result.swarmRef ? { swarmRef: result.swarmRef } : {}),
      ...(result.swarmLink ? { swarmLink: result.swarmLink } : {}),
    });
    return result;
  } catch (error) {
    console.warn('[pipeline] Activity matching failed:', error);
    if (health?.steps) useActivityStore.getState().updateActivity(input.activityId, { steps: health.steps });
    return null;
  }
}
