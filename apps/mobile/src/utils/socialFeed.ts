import type { SocialActivity } from '../stores/socialStore';
import type { Activity } from '../types';

export function mergeLocalActivities(
  activities: SocialActivity[],
  localActivities: Activity[]
): SocialActivity[] {
  const merged = new Map(activities.map((a) => [a.activityHash || a.id, a]));
  for (const local of localActivities) {
    const key = local.activityHash || local.id;
    const existing = merged.get(key);
    merged.set(key, {
      ...existing,
      ...local,
      kudos: existing?.kudos ?? local.kudos ?? [],
      comments: existing?.comments ?? local.comments ?? [],
    });
  }
  return [...merged.values()];
}
