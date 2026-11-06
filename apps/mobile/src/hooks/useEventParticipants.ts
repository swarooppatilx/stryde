import { services } from '@repo/shared';
import { useCallback, useEffect, useState } from 'react';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { SANDBOX_EVENT_PARTICIPANTS } from '@/backends/sandbox/communitySeed';
import { getCurrentUserId } from '@/constants/config';
import { useCommunityStore } from '@/stores/communityStore';
import { logger } from '@/utils/logger';

/** Seeded sign-ups plus you once joined; the Sandbox has no subgraph to ask. */
function sandboxParticipants(eventId: string, joined: boolean): string[] {
  const seeded = (SANDBOX_EVENT_PARTICIPANTS[eventId] ?? []).map((m) => m.toLowerCase());
  const me = getCurrentUserId().toLowerCase();
  const rest = seeded.filter((m) => m !== me);
  return joined ? [...rest, me] : rest;
}

/** Who signed up for an event, earliest first; null while loading or when this network can't list them. */
export function useEventParticipants(eventId: string | undefined) {
  const [participants, setParticipants] = useState<string[] | null>(null);
  // Joining or leaving changes the list, so read it again when that happens.
  const joined = useCommunityStore((s) => !!eventId && s.joinedEvents.includes(eventId));

  const load = useCallback(async () => {
    if (!eventId || eventId.startsWith('pending-')) return;
    try {
      if (PROFILES[getActiveProfileId()].fakeChain) {
        setParticipants(sandboxParticipants(eventId, joined));
        return;
      }
      const list = await services.subgraph.getEventParticipantsFromSubgraph(BigInt(eventId));
      setParticipants(list?.map((p) => p.toLowerCase()) ?? null);
    } catch (error) {
      logger.warn('[EventParticipants] Failed to load', error);
      setParticipants(null);
    }
  }, [eventId, joined]);

  useEffect(() => {
    void load();
  }, [load]);

  return { participants, reload: load };
}
