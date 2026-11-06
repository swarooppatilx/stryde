import { services } from '@repo/shared';
import { useEffect, useMemo, useState } from 'react';
import { useSocialStore } from '@/stores/socialStore';
import type { ClubActivity } from '@/utils/clubWeekly';
import { weekStart } from '@/utils/clubWeekly';
import { logger } from '@/utils/logger';

const WEEK_MS = 7 * 86_400_000;

/**
 * This week's and last week's activities by the club's members, for the leaderboard. Read from the
 * subgraph; where there is none (Sandbox, or a network without one), from the activities already on
 * this device.
 */
export function useClubActivities(members: readonly string[] | null) {
  const local = useSocialStore((s) => s.activities);
  const [remote, setRemote] = useState<ClubActivity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const key = members?.join(',') ?? '';

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the member list's contents
  useEffect(() => {
    if (!members || members.length === 0) return;
    let cancelled = false;
    const since = Math.floor((weekStart(Date.now()) - WEEK_MS) / 1000);
    setLoading(true);
    services.subgraph
      .getRecentActivitiesForUsersFromSubgraph(members as `0x${string}`[], since)
      .then((found) => {
        if (cancelled) return;
        setRemote(
          found?.map((a) => ({
            athlete: a.owner,
            distance: a.distance,
            duration: a.duration,
            at: a.timestamp * 1000,
          })) ?? null
        );
      })
      .catch((error) => {
        logger.warn('[Clubs] Could not load member activities', error);
        if (!cancelled) setRemote(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const fromDevice = useMemo<ClubActivity[]>(
    () =>
      Object.values(local).map((a) => ({
        athlete: a.userId,
        distance: a.distance,
        duration: a.duration,
        at: new Date(a.createdAt).getTime(),
      })),
    [local]
  );

  return { activities: remote ?? fromDevice, loading };
}
