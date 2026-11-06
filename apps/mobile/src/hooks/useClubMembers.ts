import { services } from '@repo/shared';
import { useCallback, useEffect, useState } from 'react';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { SANDBOX_CLUB_MEMBERS } from '@/backends/sandbox/communitySeed';
import { getCurrentUserId } from '@/constants/config';
import { useCommunityStore } from '@/stores/communityStore';
import { logger } from '@/utils/logger';
import { orderMembers } from '@/utils/orderMembers';

function sandboxMembers(clubId: string): `0x${string}`[] {
  const seeded = (SANDBOX_CLUB_MEMBERS[clubId] ?? []).map((m) => m.toLowerCase() as `0x${string}`);
  const me = getCurrentUserId().toLowerCase() as `0x${string}`;
  const joined = useCommunityStore.getState().joinedClubIds.includes(clubId);
  return joined && !seeded.includes(me) ? [...seeded, me] : seeded;
}

export type ClubMembersState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; members: string[] };

/** A club's members, owner first, read from the subgraph; "unavailable" when this network has none. */
export function useClubMembers(clubId: string | undefined, owner: string | undefined) {
  const [state, setState] = useState<ClubMembersState>({ status: 'loading' });
  // Joining or leaving changes the list, so read it again when that happens.
  const joined = useCommunityStore((s) => !!clubId && s.joinedClubIds.includes(clubId));

  const load = useCallback(async () => {
    if (!clubId) return;
    setState({ status: 'loading' });
    try {
      // The Sandbox has no chain to list members: use the seeded ones (and you, once joined).
      const members = PROFILES[getActiveProfileId()].fakeChain
        ? sandboxMembers(clubId)
        : await services.subgraph.getGroupMembersFromSubgraph(BigInt(clubId));
      setState(
        members === null
          ? { status: 'unavailable' }
          : { status: 'ready', members: orderMembers(members, owner ?? '') }
      );
    } catch (e) {
      logger.warn('[ClubMembers] Failed to load:', e);
      setState({ status: 'error' });
    }
  }, [clubId, owner]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the club or your membership changes
  useEffect(() => {
    void load();
  }, [clubId, joined]);

  return { state, reload: load };
}
