import { services } from '@repo/shared';
import {
  createMembershipHandlers,
  type MembershipIntent,
  SET_CLUB_MEMBERSHIP,
  SET_EVENT_MEMBERSHIP,
} from '@/services/membershipIntents';
import { getActiveWallet } from '@/services/wallet';
import { useCommunityStore } from '@/stores/communityStore';
import { Toast } from '@/utils/toast';
import { getOutbox, registerOutboxHandler, registerRejectionHandler } from './outbox/appOutbox';

export const clubKey = (clubId: string) => `club:${clubId}`;
export const eventKey = (eventId: string) => `event:${eventId}`;

/** Teaches the outbox how club and event membership reaches the chain, and how to undo it if refused. */
export function registerMembershipIntents(): void {
  const handlers = createMembershipHandlers({
    wallet: getActiveWallet,
    chain: {
      joinClub: (wallet, id) => services.group.joinGroup(wallet, id),
      leaveClub: (wallet, id) => services.group.leaveGroup(wallet, id),
      joinEvent: (wallet, id) => services.event.joinEvent(wallet, id),
      leaveEvent: (wallet, id) => services.event.leaveEvent(wallet, id),
    },
  });
  registerOutboxHandler(SET_CLUB_MEMBERSHIP, handlers.club);
  registerOutboxHandler(SET_EVENT_MEMBERSHIP, handlers.event);

  registerRejectionHandler(SET_CLUB_MEMBERSHIP, (entry, reason) => {
    const { id, member } = entry.payload as MembershipIntent;
    useCommunityStore.getState().applyClubMembership(id, !member);
    Toast.fail(reason, 3);
  });
  registerRejectionHandler(SET_EVENT_MEMBERSHIP, (entry, reason) => {
    const { id, member } = entry.payload as MembershipIntent;
    useCommunityStore.getState().applyEventJoin(id, !member);
    Toast.fail(reason, 3);
  });
}

async function queue(kind: string, key: string, intent: MembershipIntent): Promise<void> {
  const outbox = getOutbox();
  await outbox.enqueue({ kind, key, payload: intent });
  void outbox.drain();
}

/** Joins or leaves a club: shown at once, delivered by the outbox. */
export async function setClubMember(clubId: string, member: boolean): Promise<void> {
  useCommunityStore.getState().applyClubMembership(clubId, member);
  await queue(SET_CLUB_MEMBERSHIP, clubKey(clubId), { id: clubId, member });
}

/** Joins or leaves an event: shown at once, delivered by the outbox. */
export async function setEventMember(eventId: string, member: boolean): Promise<void> {
  useCommunityStore.getState().applyEventJoin(eventId, member);
  await queue(SET_EVENT_MEMBERSHIP, eventKey(eventId), { id: eventId, member });
}
