export const PUSH_INTENT_TTL_SECONDS = 120;

export type PushPlatform = 'android' | 'ios';

export interface PushIntent {
  owner: `0x${string}`;
  /** The Expo push token of this phone. */
  token: string;
  platform: PushPlatform;
  action: 'register' | 'unregister';
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const PUSH_TYPES = {
  PushToken: [
    { name: 'owner', type: 'address' },
    { name: 'token', type: 'string' },
    { name: 'platform', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newPushIntent(
  fields: Omit<PushIntent, 'deadline'>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): PushIntent {
  return { ...fields, deadline: nowSeconds + PUSH_INTENT_TTL_SECONDS };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function pushTypedData(intent: PushIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: PUSH_TYPES,
    primaryType: 'PushToken' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}
