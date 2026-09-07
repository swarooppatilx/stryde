import { parseEventLogs } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

export async function getTokenBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.moveToEarnToken,
    functionName: 'balanceOf',
    args: [address],
  }) as Promise<bigint>;
}

export async function isRewarded(activityHash: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.moveToEarnToken,
    functionName: 'isRewarded',
    args: [activityHash],
  }) as Promise<boolean>;
}

/**
 * Mints STRD reward tokens proportional to distance for a completed activity.
 *
 * `mintForActivity` is role-gated on-chain (MINTER_ROLE). This only succeeds when the
 * calling wallet holds that role — true today only in local dev, where every user
 * shares the deployer account. A real multi-user deployment needs a backend holding
 * the minter key instead.
 */
export async function mintTokenForActivity(
  wallet: ReturnType<typeof getWalletClient>,
  recipient: `0x${string}`,
  activityHash: `0x${string}`,
  distance: number
): Promise<{ amount: bigint; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const addresses = await wallet.getAddresses();
  const account = addresses[0];
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.moveToEarnToken,
    functionName: 'mintForActivity',
    args: [recipient, activityHash, BigInt(Math.round(distance))],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    return { amount: 0n, confirmed: false };
  }

  const [event] = parseEventLogs({
    abi: contracts.moveToEarnToken.abi,
    eventName: 'ActivityRewarded',
    logs: receipt.logs,
  });

  return {
    amount: (event?.args as { amount?: bigint } | undefined)?.amount ?? 0n,
    confirmed: true,
  };
}
