import { services } from '@repo/shared';
import type { ActivityChain } from './postRun';

type Wallet = Parameters<typeof services.activity.recordActivity>[0];

/** The real chain for one wallet, over `@repo/shared`'s contract services. */
export function createSharedActivityChain(wallet: Wallet, address: `0x${string}`): ActivityChain {
  return {
    async recordActivity(params) {
      const { activityId, txHash, confirmed } = await services.activity.recordActivity(
        wallet,
        params
      );
      return { onchainActivityId: activityId, txHash, confirmed };
    },

    async setMetadata(onchainActivityId, metadata) {
      const result = await services.activity.uploadAndSetActivityMetadata(
        wallet,
        onchainActivityId,
        metadata
      );
      return result ? { cid: result.cid, confirmed: result.confirmed } : null;
    },

    async recordSeasonContribution(activityHash, distance) {
      await services.season.ensureActiveSeason(wallet);
      await services.season.recordContribution(wallet, address, distance, activityHash);
    },

    mintReward: (activityHash, distance) =>
      services.moveToEarnToken.mintTokenForActivity(wallet, address, activityHash, distance),

    async claimTerritory(polygon, areaSqm) {
      const { territoryId, confirmed } = await services.territory.claimTerritory(wallet, {
        polygon,
        areaSqm,
      });
      return { territoryId, confirmed };
    },

    mintTerritoryNft: (territoryId) =>
      services.territoryNFT.mintTerritoryNFT(wallet, territoryId, address),
  };
}
