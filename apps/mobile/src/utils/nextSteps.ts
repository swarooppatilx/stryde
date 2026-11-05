import type { Activity } from '@/types';

/** A prompt offered right after an activity is saved. */
export type NextStep = 'share' | 'addPhoto';

/**
 * Which prompts to show under a just-saved activity, most useful first.
 * Sharing is left out for Only Me: the athlete just chose to keep it to themselves, and the shared
 * link would open an activity nobody else can see. A photo is offered only while there is none yet;
 * an Only Me photo still stays on this phone, so it is offered there too.
 */
export function nextStepsAfterSave(
  activity: Pick<Activity, 'privacy' | 'images' | 'image' | 'isManual'>,
  isOwner: boolean
): NextStep[] {
  if (!isOwner) return [];
  const canShare = activity.privacy !== 'only_me';
  const hasPhotos = (activity.images?.length ?? 0) > 0 || Boolean(activity.image);
  const steps: NextStep[] = [];
  if (canShare) steps.push('share');
  if (!hasPhotos) {
    // A manual entry has no map, so a photo is what makes it worth looking at: ask for it first.
    if (activity.isManual) steps.unshift('addPhoto');
    else steps.push('addPhoto');
  }
  return steps;
}
