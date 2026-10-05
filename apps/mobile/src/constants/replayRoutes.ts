import { loopTrack, PUNE, straightTrack } from '@/platform/fakes/tracks';

const toPoints = (fixes: Array<{ latitude: number; longitude: number }>) =>
  fixes.map(({ latitude, longitude }) => ({ latitude, longitude }));

/** Routes the dev tools can walk, all starting in Pune. */
export const REPLAY_ROUTES = [
  {
    id: 'loop',
    label: 'Loop 380 m',
    note: 'Closes on itself, so it claims territory.',
    points: toPoints(loopTrack({ center: PUNE, radiusM: 60, speedMps: 3 })),
  },
  {
    id: 'line',
    label: 'Line 1 km',
    note: 'No territory; gives one full-kilometre split.',
    points: toPoints(straightTrack({ from: PUNE, bearingDeg: 45, speedMps: 3, durationS: 334 })),
  },
  {
    id: 'long',
    label: 'Loop 2.5 km',
    note: 'Two splits and a best effort; use the fast speed.',
    points: toPoints(loopTrack({ center: PUNE, radiusM: 400, speedMps: 3 })),
  },
] as const;

/** Meters per second per sport tier. Each must stay under the sport's MAX_SPEED_KMH or every fix is rejected as an outlier: walk 10 km/h, run 25, ride 50. */
export const REPLAY_SPEEDS = [
  { value: 2.5, label: 'Walk 2.5 m/s' },
  { value: 6, label: 'Run 6 m/s' },
  { value: 8, label: 'Ride 8 m/s' },
] as const;
