import { services } from '@repo/shared';
import { useCallback, useEffect, useState } from 'react';
import { type AthleteStats, EMPTY_ATHLETE_STATS, summarizeAthlete } from '@/utils/athleteStats';
import { logger } from '@/utils/logger';

/** Territory area, achievement count and verified tick from the subgraph's composite record; best-effort, shows none when unindexed or without a subgraph. */
export function useAthleteComposite(wallet: string | undefined) {
  const [stats, setStats] = useState<AthleteStats>(EMPTY_ATHLETE_STATS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((address: string, signal: { cancelled: boolean }) => {
    return services.subgraph
      .getAthleteComposite(address as `0x${string}`)
      .then((composite) => {
        if (!signal.cancelled) setStats(summarizeAthlete(composite));
      })
      .catch((e) => logger.warn('[UserProfile] Composite subgraph query failed:', e));
  }, []);

  useEffect(() => {
    if (!wallet) return;
    // Another athlete's numbers and verified tick must not linger while this one loads.
    setStats(EMPTY_ATHLETE_STATS);
    const signal = { cancelled: false };
    void load(wallet, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [wallet, load]);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setRefreshing(true);
    try {
      await load(wallet, { cancelled: false });
    } finally {
      setRefreshing(false);
    }
  }, [wallet, load]);

  return { stats, refreshing, refresh };
}
