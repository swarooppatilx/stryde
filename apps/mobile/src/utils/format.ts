import type { Activity, ActivityType, User } from '@/types';
import { formatDay } from '@/utils/dates';
import { type WeekStartDay, weekStart } from '@/utils/trainingLog';

export function getDisplayName(user: Pick<User, 'firstName' | 'lastName' | 'username'>): string {
  if (user.firstName) {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
  }
  return user.username || 'Unknown';
}

export type UnitSystem = 'metric' | 'imperial';

export const METERS_PER_MILE = 1609.34;
const FEET_PER_METER = 3.28084;
const SQUARE_FEET_PER_SQUARE_METER = 10.7639;

export function formatDistance(rawMeters: number, unitSystem: UnitSystem = 'metric'): string {
  // A bad stored value reads as nothing, not "NaNkm".
  const meters = !Number.isFinite(rawMeters) || rawMeters < 0 ? 0 : rawMeters;
  if (unitSystem === 'imperial') {
    const feet = meters * FEET_PER_METER;
    if (feet < 5280) return `${Math.round(feet)}ft`;
    return `${(meters / METERS_PER_MILE).toFixed(2)}mi`;
  }
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

/** Height climbed or descended: whole metres, or feet for imperial. */
export function formatElevation(meters: number, unitSystem: UnitSystem = 'metric'): string {
  return unitSystem === 'imperial'
    ? `${Math.round(meters * FEET_PER_METER)}ft`
    : `${Math.round(meters)}m`;
}

/** Full sport names for headers and detail rows (filter chips use shorter ones). */
export const SPORT_LABEL: Record<string, string> = {
  run: 'Running',
  ride: 'Cycling',
  walk: 'Walking',
  hike: 'Hiking',
  swim: 'Swimming',
  yoga: 'Yoga',
  workout: 'Workout',
  hiit: 'HIIT',
  dance: 'Dance',
  climb: 'Climbing',
  skate: 'Skating',
  row: 'Rowing',
  multi: 'Multi-Sport',
};

export function formatMemberCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/** The stored route format: `lng,lat;lng,lat;...`. */
export function toPolyline(route: readonly [number, number][]): string {
  return route.map(([lng, lat]) => `${lng},${lat}`).join(';');
}

export function parsePolyline(polyline: string): [number, number][] {
  if (!polyline) return [];
  return polyline.split(';').flatMap((pair) => {
    const [lng, lat] = pair.split(',').map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [[lng, lat] as [number, number]];
  });
}

const SQUARE_METERS_PER_HECTARE = 10_000;
const SQUARE_METERS_PER_ACRE = 4046.86;

export function formatArea(squareMeters: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const acres = squareMeters / SQUARE_METERS_PER_ACRE;
    if (acres < 0.01) {
      return `${Math.round(squareMeters * SQUARE_FEET_PER_SQUARE_METER).toLocaleString()} sq ft`;
    }
    return `${acres.toFixed(2)} acres`;
  }
  if (squareMeters < SQUARE_METERS_PER_HECTARE) {
    return `${Math.round(squareMeters).toLocaleString()} m²`;
  }
  return `${(squareMeters / SQUARE_METERS_PER_HECTARE).toFixed(2)} ha`;
}

export function formatDuration(rawMs: number): string {
  const ms = !Number.isFinite(rawMs) || rawMs < 0 ? 0 : rawMs;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatDurationLong(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/** A stopwatch reading: "12:34" under an hour, "1:02:03" after; short enough to stay large on the recording screen. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Heading for a pace figure: "Pace /km" or "Pace /mi". */
export function paceLabel(unitSystem: UnitSystem = 'metric'): string {
  return unitSystem === 'imperial' ? 'Pace /mi' : 'Pace /km';
}

export function formatPace(
  distanceMeters: number,
  durationMs: number,
  unitSystem: UnitSystem = 'metric'
): string {
  if (!(distanceMeters > 0) || !(durationMs >= 0) || !Number.isFinite(durationMs)) return '--:--';
  const distanceInUnit =
    unitSystem === 'imperial' ? distanceMeters / METERS_PER_MILE : distanceMeters / 1000;
  const paceSeconds = durationMs / 1000 / distanceInUnit;
  // Paces past an hour (a walking GPS drift fix, an indoor sample with no movement) render as
  // "80:00/km" — unreadable in a big stat field. Cap at `> 59:59`.
  if (paceSeconds >= 3600) return `> 59:59${unitSystem === 'imperial' ? '/mi' : '/km'}`;
  const min = Math.floor(paceSeconds / 60);
  const sec = Math.floor(paceSeconds % 60);
  const suffix = unitSystem === 'imperial' ? '/mi' : '/km';
  return `${min}:${sec.toString().padStart(2, '0')}${suffix}`;
}

/** Sports reported in speed (km/h, mph) rather than pace (min per km or mile). */
const SPEED_SPORTS: ReadonlySet<ActivityType> = new Set(['ride', 'skate']);

export function showsSpeed(activityType: ActivityType): boolean {
  return SPEED_SPORTS.has(activityType);
}

export function formatSpeed(
  distanceMeters: number,
  durationMs: number,
  unitSystem: UnitSystem = 'metric'
): string {
  if (distanceMeters <= 0 || durationMs <= 0) return '--';
  const distanceInUnit =
    unitSystem === 'imperial' ? distanceMeters / METERS_PER_MILE : distanceMeters / 1000;
  const perHour = distanceInUnit / (durationMs / 3_600_000);
  return `${Math.round(perHour)} ${unitSystem === 'imperial' ? 'mph' : 'km/h'}`;
}

/** The figure an athlete of this sport expects: speed for a ride, pace for a run. */
export function formatPaceOrSpeed(
  activityType: ActivityType,
  distanceMeters: number,
  durationMs: number,
  unitSystem: UnitSystem = 'metric'
): string {
  return showsSpeed(activityType)
    ? formatSpeed(distanceMeters, durationMs, unitSystem)
    : formatPace(distanceMeters, durationMs, unitSystem);
}

export function paceOrSpeedLabel(
  activityType: ActivityType,
  unitSystem: UnitSystem = 'metric'
): string {
  if (!showsSpeed(activityType)) return paceLabel(unitSystem);
  return unitSystem === 'imperial' ? 'Speed mph' : 'Speed km/h';
}

/** The word in a default title, by the local hour the activity started: 4-10 Morning, 11-12 Lunch, 13-17 Afternoon, 18-20 Evening, else Night. */
function getTimeOfDay(hour: number): 'Morning' | 'Lunch' | 'Afternoon' | 'Evening' | 'Night' {
  if (hour >= 4 && hour < 11) return 'Morning';
  if (hour >= 11 && hour < 13) return 'Lunch';
  if (hour >= 13 && hour < 18) return 'Afternoon';
  if (hour >= 18 && hour < 21) return 'Evening';
  return 'Night';
}

export function getActivityName(type: string, hour: number): string {
  const timeOfDay = getTimeOfDay(hour);
  const labels: Record<string, string> = {
    run: 'Run',
    ride: 'Ride',
    walk: 'Walk',
    hike: 'Hike',
    swim: 'Swim',
    yoga: 'Yoga',
    workout: 'Workout',
    hiit: 'HIIT',
    dance: 'Dance',
    climb: 'Climb',
    skate: 'Skate',
    row: 'Row',
  };
  return `${timeOfDay} ${labels[type] || 'Activity'}`;
}

export function formatRelativeTime(date: Date, compact = false): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return compact ? `${mins}m` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return compact ? `${hrs}h` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1 && !compact) return 'yesterday';
  // A notification from last week still says how old it is; a date only takes over once it is a month old.
  if (days < 30) return compact ? `${days}d` : `${days}d ago`;
  return formatDay(date);
}

export function getInitials(name: string): string {
  if (!name?.trim()) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export interface WeeklyStats {
  activityCount: number;
  totalDistance: number;
  totalDuration: number;
  dailyActivityCount: number[];
}

/** This week's totals, with one activity count per day starting from the week's first day. */
export function getWeeklyStats(
  activities: Activity[],
  startsOn: WeekStartDay = 0,
  now: Date = new Date()
): WeeklyStats {
  const weekStartAt = weekStart(now, startsOn);

  const dailyActivityCount = [0, 0, 0, 0, 0, 0, 0];
  let activityCount = 0;
  let totalDistance = 0;
  let totalDuration = 0;
  for (const a of activities) {
    const createdAt = new Date(a.createdAt);
    if (createdAt < weekStartAt) continue;
    activityCount++;
    totalDistance += a.distance;
    totalDuration += a.duration;
    const day = (createdAt.getDay() - startsOn + 7) % 7;
    dailyActivityCount[day] = (dailyActivityCount[day] ?? 0) + 1;
  }

  return {
    activityCount,
    totalDistance,
    totalDuration,
    dailyActivityCount,
  };
}

export interface SportStats {
  type: ActivityType;
  count: number;
  totalDistance: number;
}

export function getSportStats(activities: Activity[]): SportStats[] {
  const stats: Record<string, SportStats> = {};

  activities.forEach((a) => {
    const type = a.activityType || 'run';
    if (!stats[type]) {
      stats[type] = { type: type as ActivityType, count: 0, totalDistance: 0 };
    }
    stats[type].count++;
    stats[type].totalDistance += a.distance;
  });

  return Object.values(stats).sort((a, b) => b.count - a.count);
}

/** The name to show for an activity: the athlete's own, or the default title when it is missing (another athlete's name lives in IPFS metadata the feed does not fetch). */
export function activityTitle(activity: {
  name?: string;
  activityType: string;
  createdAt: Date;
}): string {
  const name = activity.name?.trim();
  return name || getActivityName(activity.activityType, new Date(activity.createdAt).getHours());
}
