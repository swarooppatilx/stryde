import { countOf } from './plural';

/** The line under the athlete's name. */
export function activityCountLine(activities: number): string {
  return countOf(activities, 'activity', 'activities');
}
