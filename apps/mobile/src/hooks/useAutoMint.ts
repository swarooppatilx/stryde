import { services } from '@repo/shared';
import { useEffect, useState } from 'react';
import type { WalletClient } from 'viem';
import { mintMissing } from '@/services/mintMissing';
import type { Ring } from '@/types';
import type { Achievement } from '@/utils/achievements';
import { logger } from '@/utils/logger';

type Wallet = { wallet: WalletClient | null; address: `0x${string}` | null };

/** Mints each unlocked achievement as a soulbound badge; returns the ids already minted. */
export function useAchievementBadges(
  { wallet, address }: Wallet,
  unlocked: readonly Achievement[]
): ReadonlySet<string> {
  const [minted, setMinted] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!wallet || !address || unlocked.length === 0) return;
    let cancelled = false;
    const titles = new Map(unlocked.map((a) => [a.id, a.title]));
    void mintMissing({
      ids: unlocked.map((a) => a.id),
      getMinted: (ids) => services.achievement.getMintedAchievementIds(address, [...ids]),
      mint: async (id) => {
        await services.achievement.mintAchievement(wallet, id, titles.get(id) ?? id);
      },
      onMinted: setMinted,
      isCancelled: () => cancelled,
      onError: (id, err) => logger.warn('[AutoMint] Achievement mint failed', id, err),
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, address, unlocked]);

  return minted;
}

/** Retries territory NFT mints that failed after a claim; returns the territory hashes already minted. */
export function useTerritoryNfts(
  { wallet, address }: Wallet,
  polygons: readonly Ring[]
): ReadonlySet<`0x${string}`> {
  const [minted, setMinted] = useState<ReadonlySet<`0x${string}`>>(new Set());

  useEffect(() => {
    if (!wallet || !address || polygons.length === 0) return;
    let cancelled = false;
    void mintMissing({
      ids: polygons.map((polygon) => services.territory.computePolygonHash(polygon)),
      getMinted: (ids) => services.territoryNFT.getMintedTerritoryIds([...ids]),
      mint: async (hash) => {
        await services.territoryNFT.mintTerritoryNFT(wallet, hash, address);
      },
      onMinted: setMinted,
      isCancelled: () => cancelled,
      onError: (hash, err) => logger.warn('[AutoMint] Territory NFT mint failed', hash, err),
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, address, polygons]);

  return minted;
}
