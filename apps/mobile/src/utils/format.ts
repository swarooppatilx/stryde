import type { Activity, ActivityType } from '@/types';

export function formatDistance(meters: number): string {
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

export function formatArea(squareMeters: number): string {
  if (squareMeters === 0) return '0 acres';
  const acres = squareMeters / 4046.86;
  if (acres < 0.01) return `${squareMeters.toFixed(0)} m²`;
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

export function formatPace(distanceMeters: number, durationMs: number): string {
  if (distanceMeters === 0) return '--:--';
  const paceSeconds = (durationMs / 1000 / distanceMeters) * 1000;
  const min = Math.floor(paceSeconds / 60);
  const sec = Math.floor(paceSeconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function getActivityName(type: string, hour: number): string {
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const labels: Record<string, string> = {
    run: 'Run',
    ride: 'Ride',
    walk: 'Walk',
    hike: 'Hike',
  };
  return `${timeOfDay} ${labels[type] || 'Activity'}`;
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
