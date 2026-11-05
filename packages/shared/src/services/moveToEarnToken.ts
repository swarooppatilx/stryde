import { getContracts, getPublicClient, type getWalletClient } from './client';
import { relayMintReward } from './relay';

export async function getTokenBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.moveToEarnToken,
    functionName: 'balanceOf',
    args: [address],
  });
}

export async function isRewarded(activityHash: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.moveToEarnToken,
    functionName: 'isRewarded',
    args: [activityHash],
  });
}

/** Asks the relayer to mint STRD for the distance: `mintForActivity` is MINTER_ROLE-gated and an athlete's own wallet does not hold the role, on Sepolia or on a local chain alike. */
export async function mintTokenForActivity(
  _wallet: ReturnType<typeof getWalletClient>,
  recipient: `0x${string}`,
  activityHash: `0x${string}`,
  distance: number
): Promise<{ amount: bigint; confirmed: boolean }> {
  const result = await relayMintReward(recipient, activityHash, distance);
  return { amount: 0n, confirmed: result.confirmed };
}
