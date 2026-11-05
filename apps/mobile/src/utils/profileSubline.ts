import { countOf } from './plural';

/** The line under the athlete's name. */
export function activityCountLine(activities: number): string {
  return countOf(activities, 'activity', 'activities');
}

/** The social counts, on a line of their own under the header. */
export function followCountsLine({
  followers,
  following,
}: {
  followers: number;
  following: number;
}): string {
  return `${countOf(followers, 'follower', 'followers')} · ${following} following`;
}
