export const ACCOUNT_DELETE_INTENT_TTL_SECONDS = 120;

export interface AccountDeleteIntent {
  owner: `0x${string}`;
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const ACCOUNT_DELETE_TYPES = {
  AccountDelete: [
    { name: 'owner', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newAccountDeleteIntent(
  fields: Omit<AccountDeleteIntent, 'deadline'>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): AccountDeleteIntent {
  return { ...fields, deadline: nowSeconds + ACCOUNT_DELETE_INTENT_TTL_SECONDS };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function accountDeleteTypedData(intent: AccountDeleteIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: ACCOUNT_DELETE_TYPES,
    primaryType: 'AccountDelete' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}
