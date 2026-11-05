import { getPlatform } from '@/platform';
import { useCommunityStore } from '@/stores/communityStore';
import { useSocialStore } from '@/stores/socialStore';
import { logger } from '@/utils/logger';
import { buildCommunitySeed, mergeCommunitySeed } from './communitySeed';
import { buildSeed, mergeSeed } from './seed';

/**
 * Puts the seeded athletes and posts into the feed, and a club and an event into Groups. Waits for
 * the saved state to load first, so the seed only fills gaps and never replaces anything the
 * developer did.
 */
export function applySeed(): void {
  seedCommunity();
  const run = () => {
    const { users, activities } = useSocialStore.getState();
    const merged = mergeSeed({ users, activities }, buildSeed(getPlatform().clock.now()));
    useSocialStore.setState(merged);
    logger.info(`[Sandbox] Seeded feed: ${Object.keys(merged.users).length} athletes`);
  };
  if (useSocialStore.persist.hasHydrated()) run();
  else useSocialStore.persist.onFinishHydration(run);
}

function seedCommunity(): void {
  const run = () => {
    const { clubs, events } = useCommunityStore.getState();
    useCommunityStore.setState(
      mergeCommunitySeed({ clubs, events }, buildCommunitySeed(getPlatform().clock.now()))
    );
  };
  if (useCommunityStore.persist.hasHydrated()) run();
  else useCommunityStore.persist.onFinishHydration(run);
}
