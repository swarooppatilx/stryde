import type { WalletClient } from 'viem';
import { type Handler, RejectedError } from '@/backends/outbox/outbox';
import { isApiRefusal } from '@/utils/isApiRefusal';

export const REGISTER_PUSH = 'registerPushToken';
/** One slot: a newer intent for this phone's token replaces one still waiting. */
export const PUSH_KEY = 'push:token';

export interface PushRegistration {
  token: string;
  platform: 'android' | 'ios';
}

export interface PushDeps {
  wallet(): WalletClient | null;
  send(wallet: WalletClient, registration: PushRegistration): Promise<unknown>;
}

/** How a registration reaches the server. Safe to repeat: the server keeps one record per token. */
export function createPushRegisterHandler(deps: PushDeps): Handler {
  return async (payload) => {
    const wallet = deps.wallet();
    if (!wallet) throw new Error('No wallet yet');
    try {
      await deps.send(wallet, payload as PushRegistration);
    } catch (error) {
      if (isApiRefusal(error)) {
        throw new RejectedError(error instanceof Error ? error.message : 'Refused');
      }
      throw error;
    }
  };
}
