import type { ChallengeEvent } from '@/types/event';

/**
 * Other events still worth a look: not the one being viewed, not ended. Ones on now come first
 * (the one ending soonest leading), then upcoming ones by start date.
 */
export function otherEvents(
  events: readonly ChallengeEvent[],
  currentId: string,
  now: Date,
  limit: number
): ChallengeEvent[] {
  const at = now.getTime();
  const live = events
    .filter((e) => e.id !== currentId && e.startDate.getTime() <= at && e.endDate.getTime() >= at)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  const upcoming = events
    .filter((e) => e.id !== currentId && e.startDate.getTime() > at)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return [...live, ...upcoming].slice(0, limit);
}

/** Events as the Groups list shows them: on now, then upcoming soonest first, then ended ones latest first. */
export function orderEvents(events: readonly ChallengeEvent[], now: Date): ChallengeEvent[] {
  const at = now.getTime();
  const live = events
    .filter((e) => e.startDate.getTime() <= at && e.endDate.getTime() >= at)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  const upcoming = events
    .filter((e) => e.startDate.getTime() > at)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const ended = events
    .filter((e) => e.endDate.getTime() < at)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  return [...live, ...upcoming, ...ended];
}
