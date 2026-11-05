import { formatDistance, formatDuration, type UnitSystem } from './format';
import type { WeekBucket } from './trainingLog';

export type WeekMetric = 'distance' | 'time' | 'activities';

export const METRIC_OPTIONS: readonly { value: WeekMetric; label: string }[] = [
  { value: 'distance', label: 'Distance' },
  { value: 'time', label: 'Time' },
  { value: 'activities', label: 'Activities' },
];

/** The figure a week's bar stands for: metres, milliseconds or a count. */
export function metricValue(week: WeekBucket, metric: WeekMetric): number {
  switch (metric) {
    case 'distance':
      return week.distance;
    case 'time':
      return week.duration;
    case 'activities':
      return week.count;
  }
}

/** A weekly figure as text, in the unit system the athlete uses. */
export function metricText(value: number, metric: WeekMetric, unitSystem: UnitSystem): string {
  switch (metric) {
    case 'distance':
      return formatDistance(value, unitSystem);
    case 'time':
      return formatDuration(value);
    case 'activities':
      return String(value);
  }
}
