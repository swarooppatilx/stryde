import { services } from '@repo/shared';
import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import { orderMembers } from '@/utils/orderMembers';

export type ClubMembersState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; members: string[] };

/** A club's members, owner first, read from the subgraph; "unavailable" when this network has none. */
export function useClubMembers(clubId: string | undefined, owner: string | undefined) {
  const [state, setState] = useState<ClubMembersState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!clubId) return;
    setState({ status: 'loading' });
    try {
      const members = await services.subgraph.getGroupMembersFromSubgraph(BigInt(clubId));
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the club changes
  useEffect(() => {
    void load();
  }, [clubId]);

  return { state, reload: load };
}
