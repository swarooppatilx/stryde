import type { SocialActivity } from '../stores/socialStore';
import type { Activity } from '../types';

export function mergeLocalActivities(
  activities: Record<string, SocialActivity>,
  localActivities: Activity[]
): Record<string, SocialActivity> {
  const merged: Record<string, SocialActivity> = {};
  for (const activity of Object.values(activities)) {
    merged[(activity.activityHash || activity.id).toLowerCase()] = activity;
  }
  for (const local of localActivities) {
    const key = (local.activityHash || local.id).toLowerCase();
    const existing = merged[key];
    merged[key] = {
      ...existing,
      ...local,
      activityId: existing?.activityId ?? (local as Activity & { activityId?: bigint }).activityId,
      kudos: existing?.kudos ?? local.kudos ?? [],
      comments: existing?.comments ?? local.comments ?? [],
    };
  }
  return merged;
}
