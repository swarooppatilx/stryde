import type { HeartRateSample } from './healthService';
import { apiFetch } from './strydeApi';

export interface Segment {
  key: string;
  name: string;
  sportType: number;
  geohash: string;
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  distanceM: number;
  creator: string;
  owner: string;
  expiresAt?: number | null;
}

export interface Effort {
  key: string;
  segmentKey: string;
  athlete: string;
  elapsedSec: number;
  seasonId: number;
  verifiedHuman: boolean;
  sweatVerified: boolean;
  sweatScore: number;
  avgBpm: number | null;
  activityId: number;
  recordedAt: number;
  swarmRef: string | null;
}

export interface SweatResult {
  score: number;
  avgBpm: number;
  maxBpm: number;
  sampleCount: number;
  coverage: number;
  verified: boolean;
  reason: string;
}

export interface MatchResult {
  sweat: SweatResult;
  verifiedHuman: boolean;
  swarmRef: string | null;
  swarmLink: string | null;
  segmentsChecked: number;
  efforts: Array<{
    key: string;
    txHash: string;
    segmentKey: string;
    segmentName: string;
    elapsedSec: number;
  }>;
}

export interface Beacon {
  key: string;
  runId: string;
  athlete: string;
  latitude: number;
  longitude: number;
  paceSecPerKm: number;
  batteryPct: number | null;
  updatedAt: number;
  expiresAt?: number | null;
}

export interface TimedPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export const ARKIV_EXPLORER = 'https://rabdi.explorer.arkiv.network';

export function getArkivInfo() {
  return apiFetch<{ arkiv: boolean; swarm: boolean; writer?: string; explorer?: string }>(
    '/arkiv/info'
  );
}

export function nearbySegments(latitude: number, longitude: number) {
  return apiFetch<{ geohashPrefix: string; segments: Segment[] }>(
    `/arkiv/segments?lat=${latitude}&lng=${longitude}`
  );
}

export function getSegment(key: string) {
  return apiFetch<Segment>(`/arkiv/segments/${key}`);
}

export function segmentLeaderboard(key: string, scope: 'verified' | 'all') {
  return apiFetch<{ segmentKey: string; verifiedOnly: boolean; efforts: Effort[] }>(
    `/arkiv/segments/${key}/leaderboard?scope=${scope}`
  );
}

export function createSegment(input: {
  name: string;
  sportType: number;
  creator: string;
  track: Array<{ latitude: number; longitude: number }>;
}) {
  return apiFetch<{ key: string; txHash: string; distanceM: number }>('/arkiv/segments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function athleteEfforts(wallet: string) {
  return apiFetch<{ efforts: Effort[] }>(`/arkiv/athletes/${wallet}/efforts`);
}

export function matchActivity(input: {
  athlete: string;
  activityId: number;
  name: string;
  distanceM: number;
  track: TimedPoint[];
  heartRate?: { samples: HeartRateSample[]; restingBpm?: number | null };
  privateRoute: boolean;
  scoreOnly?: boolean;
}) {
  return apiFetch<MatchResult>('/arkiv/activities/match', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      heartRate: input.heartRate
        ? { samples: input.heartRate.samples, restingBpm: input.heartRate.restingBpm ?? undefined }
        : undefined,
    }),
  });
}

export function pushBeacon(input: {
  runId: string;
  athlete: string;
  latitude: number;
  longitude: number;
  paceSecPerKm: number;
  batteryPct?: number | null;
}) {
  return apiFetch<{ key: string; created: boolean }>('/arkiv/beacons', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getBeacon(runId: string) {
  return apiFetch<Beacon>(`/arkiv/beacons/${runId}`);
}

export function endBeacon(runId: string) {
  return apiFetch<{ ended: boolean }>(`/arkiv/beacons/${runId}`, { method: 'DELETE' });
}
