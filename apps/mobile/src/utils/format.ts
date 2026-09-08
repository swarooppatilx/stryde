import type { Activity, ActivityType, User } from '@/types';

export function getDisplayName(user: User): string {
  if (user.firstName) {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
  }
  return user.username || 'Unknown';
}

export type UnitSystem = 'metric' | 'imperial';

const METERS_PER_MILE = 1609.34;
const FEET_PER_METER = 3.28084;
const SQUARE_FEET_PER_SQUARE_METER = 10.7639;

export function formatDistance(meters: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const feet = meters * FEET_PER_METER;
    if (feet < 5280) return `${Math.round(feet)}ft`;
    return `${(meters / METERS_PER_MILE).toFixed(2)}mi`;
  }
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

export function parsePolyline(polyline: string): [number, number][] {
  if (!polyline) return [];
  return polyline
    .split(';')
    .map((pair) => {
      const [lng, lat] = pair.split(',').map(Number);
      return [lng, lat] as [number, number];
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

export function formatArea(squareMeters: number, unitSystem: UnitSystem = 'metric'): string {
  if (squareMeters === 0) return unitSystem === 'imperial' ? '0 sq ft' : '0 acres';
  const acres = squareMeters / 4046.86;
  if (acres < 0.01) {
    if (unitSystem === 'imperial') {
      return `${(squareMeters * SQUARE_FEET_PER_SQUARE_METER).toFixed(0)} sq ft`;
    }
    return `${squareMeters.toFixed(0)} m²`;
  }
  return `${acres.toFixed(2)} acres`;
}

export function formatDuration(ms: number): string {
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

export function formatPace(
  distanceMeters: number,
  durationMs: number,
  unitSystem: UnitSystem = 'metric'
): string {
  if (distanceMeters === 0) return '--:--';
  const distanceInUnit =
    unitSystem === 'imperial' ? distanceMeters / METERS_PER_MILE : distanceMeters / 1000;
  const paceSeconds = durationMs / 1000 / distanceInUnit;
  const min = Math.floor(paceSeconds / 60);
  const sec = Math.floor(paceSeconds % 60);
  const suffix = unitSystem === 'imperial' ? '/mi' : '/km';
  return `${min}:${sec.toString().padStart(2, '0')}${suffix}`;
}

export function getActivityName(type: string, hour: number): string {
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
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
  if (days < 7) return compact ? `${days}d` : `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getInitials(name: string): string {
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

export function getWeeklyStats(activities: Activity[]): WeeklyStats {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekActivities = activities.filter((a) => new Date(a.createdAt) >= weekStart);

  const dailyActivityCount = [0, 0, 0, 0, 0, 0, 0];
  weekActivities.forEach((a) => {
    const day = new Date(a.createdAt).getDay();
    dailyActivityCount[day]++;
  });

  return {
    activityCount: weekActivities.length,
    totalDistance: weekActivities.reduce((sum, a) => sum + a.distance, 0),
    totalDuration: weekActivities.reduce((sum, a) => sum + a.duration, 0),
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
