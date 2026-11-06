import { services } from '@repo/shared';
import { logger } from '@/utils/logger';

export interface SnapshotTerritory {
  id: string;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
}

export interface ChainSnapshot {
  activities: services.sync.SyncedActivity[];
  /** null = couldn't be read, which must not be mistaken for "owns none". */
  territories: SnapshotTerritory[] | null;
  profile: services.sync.SyncedProfile;
}

const UNREGISTERED: services.sync.SyncedProfile = { isRegistered: false, profileId: null };

/** One failing registry read must not discard the activities or profile that did sync. */
async function readRegistries(wallet: `0x${string}`): Promise<ChainSnapshot> {
  const results = await Promise.allSettled([
    services.sync.syncActivitiesFromChain(wallet),
    services.sync.syncTerritoriesFromChain(wallet),
    services.sync.syncProfileFromChain(wallet),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') logger.warn('[ChainSync] Partial sync failure:', r.reason);
  }
  const [activities, territories, profile] = results;
  return {
    activities: activities.status === 'fulfilled' ? activities.value : [],
    territories:
      territories.status === 'fulfilled'
        ? territories.value.map((t) => ({
            id: t.id,
            areaSqm: t.areaSqm,
            strength: t.controlStrength,
            capturedAt: t.capturedAt,
            lastReinforced: t.lastReinforced,
          }))
        : null,
    profile: profile.status === 'fulfilled' ? profile.value : UNREGISTERED,
  };
}

/**
 * What the chain knows about a wallet. Prefers one composed subgraph query over the per-registry
 * calls; falls back to them when no subgraph exists for the mode (local Anvil) or it fails or
 * returns nothing.
 */
export async function fetchChainSnapshot(wallet: `0x${string}`): Promise<ChainSnapshot> {
  const composite = await services.subgraph.getAthleteComposite(wallet).catch((e) => {
    logger.warn('[ChainSync] Composite subgraph query failed, falling back:', e);
    return null;
  });
  if (!composite) return readRegistries(wallet);
  return {
    activities: composite.activities,
    // Decayed or lost territories stay in the index flagged inactive.
    territories: composite.territories.filter((t) => t.isActive),
    profile: { isRegistered: true, profileId: composite.profileId },
  };
}
