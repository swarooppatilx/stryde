import type { services } from '@repo/shared';
import type { Activity } from '@/types';

export type ChainActivity = services.sync.SyncedActivity;

/**
 * Folds the athlete's onchain activities into what this device already has. The chain is authoritative
 * for owner, hash and id; the device for what the user typed and anything only it knows (privacy, feel,
 * STRD earned), which is kept whole so a sync cannot turn followers-only runs public.
 */
export function mergeChainActivities(
  local: Activity[],
  allChain: ChainActivity[],
  deletedHashes: ReadonlySet<string> = new Set()
): Activity[] {
  const chain = allChain.filter((c) => !deletedHashes.has(c.activityHash.toLowerCase()));
  const localByHash = new Map(
    local.flatMap((a) => (a.activityHash ? [[a.activityHash, a] as const] : []))
  );

  const merged = chain.map((c): Activity => {
    const mine = localByHash.get(c.activityHash);
    return {
      ...mine,
      id: mine?.id ?? c.activityHash,
      userId: c.owner,
      name: mine?.name || c.metadataName || '',
      description: mine?.description || c.metadataDescription,
      activityType: mine?.activityType || c.activityType,
      distance: mine?.distance ?? c.distance,
      duration: mine?.duration ?? c.duration,
      polyline: mine?.polyline || c.metadataPolyline || '',
      territory: mine?.territory || c.metadataTerritory || null,
      territoryArea: mine?.territoryArea ?? c.territoryArea,
      createdAt: mine?.createdAt || new Date(c.timestamp * 1000),
      txHash: mine?.txHash,
      onchainActivityId: mine?.onchainActivityId ?? c.activityId.toString(),
      metadataCid: mine?.metadataCid ?? c.metadataCid,
      image: mine?.image ?? c.metadataPhotos?.[0],
      images: mine?.images ?? c.metadataPhotos,
      activityHash: c.activityHash,
    };
  });

  const onChain = new Set(chain.map((c) => c.activityHash));
  const notYetOnChain = local.filter((a) => !(a.activityHash && onChain.has(a.activityHash)));

  return [...merged, ...notYetOnChain];
}
