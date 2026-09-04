import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

export async function isRegistered(wallet: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'isRegistered',
    args: [wallet],
  }) as Promise<boolean>;
}

export async function getProfileId(wallet: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getProfileId',
    args: [wallet],
  }) as Promise<bigint>;
}

export async function getWallet(profileId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getWallet',
    args: [profileId],
  }) as Promise<`0x${string}`>;
}

export async function totalProfiles(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'totalProfiles',
  }) as Promise<bigint>;
}

export async function register(
  wallet: ReturnType<typeof getWalletClient>,
  username: string
): Promise<{ txHash: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const addresses = await wallet.getAddresses();
  const account = addresses[0];
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.profileRegistry,
    functionName: 'register',
    args: [username],
    account,
    chain: config.chain,
  });

  return { txHash: hash };
}
