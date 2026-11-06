import { services } from '@repo/shared';
import { getCurrentUserId } from '@/constants/config';
import {
  CLUB_ACTION,
  type ClubActionIntent,
  createClubActionHandler,
} from '@/services/clubIntents';
import { getActiveWallet } from '@/services/wallet';
import { type ClubChange, useClubStore } from '@/stores/clubStore';
import { Toast } from '@/utils/toast';
import { getOutbox, registerOutboxHandler, registerRejectionHandler } from './outbox/appOutbox';

/** Teaches the outbox how a club action is signed and sent. */
export function registerClubIntents(): void {
  registerOutboxHandler(
    CLUB_ACTION,
    createClubActionHandler({
      wallet: getActiveWallet,
      send: (wallet, intent) => services.clubs.sendClubAction(wallet, intent),
      onDelivered: (clubId) => void useClubStore.getState().load(clubId),
    })
  );
  registerRejectionHandler(CLUB_ACTION, (entry, reason) => {
    // Refused for good: put the club back the way the server has it, and say why.
    void useClubStore.getState().load((entry.payload as ClubActionIntent).clubId);
    Toast.fail(reason, 3);
  });
}

let clientCounter = 0;

/** Shows a club change at once and leaves its delivery to the outbox. */
export async function sendClubChange(change: ClubChange): Promise<void> {
  const clientId =
    change.action === 'post' || change.action === 'comment'
      ? (change.clientId ?? `${Date.now().toString(36)}-${(clientCounter++).toString(36)}`)
      : change.clientId;
  const full = { ...change, clientId };
  useClubStore.getState().applyLocal(full, getCurrentUserId().toLowerCase() as `0x${string}`);
  const outbox = getOutbox();
  // Settings, roles and requests about the same subject replace a waiting one; posts never do.
  const keyed = !['post', 'comment', 'delete-post', 'delete-comment'].includes(change.action);
  await outbox.enqueue({
    kind: CLUB_ACTION,
    key: keyed ? `club:${change.clubId}:${change.action}:${change.target ?? ''}` : undefined,
    payload: full satisfies ClubActionIntent,
  });
  void outbox.drain();
}
