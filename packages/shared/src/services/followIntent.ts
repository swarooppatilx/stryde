export const FOLLOW_INTENT_TTL_SECONDS = 120;

export type FollowAction = 'follow' | 'unfollow';

export interface FollowIntent {
  follower: `0x${string}`;
  followee: `0x${string}`;
  action: FollowAction;
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const FOLLOW_TYPES = {
  Follow: [
    { name: 'follower', type: 'address' },
    { name: 'followee', type: 'address' },
    { name: 'action', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newFollowIntent(
  fields: Omit<FollowIntent, 'deadline'>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): FollowIntent {
  return { ...fields, deadline: nowSeconds + FOLLOW_INTENT_TTL_SECONDS };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function followTypedData(intent: FollowIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: FOLLOW_TYPES,
    primaryType: 'Follow' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}
