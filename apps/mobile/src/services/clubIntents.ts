import type { ClubAction } from '@repo/shared';
import type { WalletClient } from 'viem';
import { type Handler, RejectedError } from '@/backends/outbox/outbox';
import { isApiRefusal } from '@/utils/isApiRefusal';

export const CLUB_ACTION = 'clubAction';

export interface ClubActionIntent {
  clubId: string;
  action: ClubAction;
  target?: string;
  data?: Record<string, unknown>;
  clientId?: string;
}

export interface ClubIntentDeps {
  wallet(): WalletClient | null;
  send(wallet: WalletClient, intent: ClubActionIntent): Promise<unknown>;
  /** The server has it: refresh the club so local stand-ins give way to the real records. */
  onDelivered(clubId: string): void;
}

/** Delivers one signed club action. A 4xx (or the daily limit) is final; anything else is retried. */
export function createClubActionHandler(deps: ClubIntentDeps): Handler {
  return async (payload) => {
    const intent = payload as ClubActionIntent;
    const wallet = deps.wallet();
    if (!wallet) throw new Error('No wallet yet');
    try {
      await deps.send(wallet, intent);
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      if (isApiRefusal(error) || status === 429) {
        throw new RejectedError(error instanceof Error ? error.message : 'Refused');
      }
      throw error;
    }
    deps.onDelivered(intent.clubId);
  };
}
