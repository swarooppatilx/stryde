import type { WalletClient } from 'viem';
import type { Handler } from '@/backends/outbox/outbox';
import { refuseContractRevert } from '@/services/refusals';
import { revertName } from '@/utils/isContractRevert';

export const SET_CLUB_MEMBERSHIP = 'setClubMembership';
export const SET_EVENT_MEMBERSHIP = 'setEventMembership';

/** Whether the athlete should be in club/event `id`. A state, not a toggle, so it is safe to repeat. */
export interface MembershipIntent {
  id: string;
  member: boolean;
}

type Send = (wallet: WalletClient, id: bigint) => Promise<{ confirmed: boolean }>;

export interface MembershipDeps {
  wallet(): WalletClient | null;
  chain: { joinClub: Send; leaveClub: Send; joinEvent: Send; leaveEvent: Send };
}

export interface MembershipHandlers {
  club: Handler;
  event: Handler;
}

/** Reverts that mean the wanted state already holds (an earlier try went through). */
const ALREADY_THERE = new Set(['AlreadyMember', 'NotMember', 'AlreadyJoined', 'NotParticipant']);

function handlerFor(deps: MembershipDeps, join: Send, leave: Send, what: string): Handler {
  return async (payload) => {
    const { id, member } = payload as MembershipIntent;
    const wallet = deps.wallet();
    if (!wallet) throw new Error('No wallet yet');
    try {
      const result = await (member ? join : leave)(wallet, BigInt(id));
      if (!result.confirmed) throw new Error('The change did not confirm yet');
    } catch (error) {
      const name = revertName(error);
      if (name !== null && ALREADY_THERE.has(name)) return;
      refuseContractRevert(error, what);
    }
  };
}

/** How joining and leaving a club or event reaches the chain. Every handler is safe to repeat. */
export function createMembershipHandlers(deps: MembershipDeps): MembershipHandlers {
  return {
    club: handlerFor(deps, deps.chain.joinClub, deps.chain.leaveClub, 'club change'),
    event: handlerFor(deps, deps.chain.joinEvent, deps.chain.leaveEvent, 'event change'),
  };
}
