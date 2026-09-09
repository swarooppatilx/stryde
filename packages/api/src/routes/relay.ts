import { type ChainMode, getChainConfig } from '@repo/shared/constants';
import { ABIS } from '@repo/shared/contracts';
import { Hono } from 'hono';
import type { Abi } from 'viem';
import { getRelayerPublicClient, getRelayerWallet } from '../lib/relayer.js';

export const relay = new Hono();

const typedAbis = ABIS as Record<string, Abi>;

function getContract(name: string): { address: `0x${string}`; abi: Abi } {
  const chainId = Number(process.env.RELAYER_CHAIN_ID);
  const modes: Record<number, ChainMode> = {
    11155111: 'ethereum-sepolia',
    84532: 'base-sepolia',
    31337: 'local',
  };
  const mode = modes[chainId];
  if (!mode) throw new Error(`[relay] Unknown chain ID ${chainId}`);
  const config = getChainConfig(mode);
  const contracts = config.contracts as Record<string, `0x${string}`>;
  const address = contracts[name];
  const abi = typedAbis[name];
  if (!address || !abi) throw new Error(`[relay] Unknown contract: ${name}`);
  return { address, abi };
}

function resolveChain() {
  const chainId = Number(process.env.RELAYER_CHAIN_ID);
  const modes: Record<number, ChainMode> = {
    11155111: 'ethereum-sepolia',
    84532: 'base-sepolia',
    31337: 'local',
  };
  const mode = modes[chainId];
  if (!mode) throw new Error(`[relay] Unknown chain ID ${chainId}`);
  return getChainConfig(mode).chain;
}

relay.post('/mint-achievement', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { recipient, achievementId, achievementName } = body;
  if (!recipient || !achievementId || !achievementName) {
    return c.json(
      { error: 'Missing required fields: recipient, achievementId, achievementName' },
      400
    );
  }

  const wallet = getRelayerWallet();
  const publicClient = getRelayerPublicClient();
  const contract = getContract('achievementRegistry');
  const chain = resolveChain();
  const account = wallet.account!.address;

  const hash = await wallet.writeContract({
    ...contract,
    functionName: 'defineAchievement',
    args: [achievementId, achievementName],
    account,
    chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const mintHash = await wallet.writeContract({
    ...contract,
    functionName: 'mintAchievement',
    args: [recipient, achievementId],
    account,
    chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });

  return c.json({ hash: mintHash, confirmed: receipt.status === 'success' });
});

relay.post('/mint-reward', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { recipient, activityHash, distance } = body;
  if (!recipient || !activityHash || distance === undefined) {
    return c.json({ error: 'Missing required fields: recipient, activityHash, distance' }, 400);
  }

  const wallet = getRelayerWallet();
  const publicClient = getRelayerPublicClient();
  const contract = getContract('moveToEarnToken');
  const chain = resolveChain();
  const account = wallet.account!.address;

  const hash = await wallet.writeContract({
    ...contract,
    functionName: 'mintForActivity',
    args: [recipient, activityHash, BigInt(Math.round(distance))],
    account,
    chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return c.json({ hash, confirmed: receipt.status === 'success' });
});

relay.post('/mint-territory-nft', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { recipient, polygonHash } = body;
  if (!recipient || !polygonHash) {
    return c.json({ error: 'Missing required fields: recipient, polygonHash' }, 400);
  }

  const wallet = getRelayerWallet();
  const publicClient = getRelayerPublicClient();
  const contract = getContract('territoryNFT');
  const chain = resolveChain();
  const account = wallet.account!.address;

  const hash = await wallet.writeContract({
    ...contract,
    functionName: 'mintTerritory',
    args: [recipient, polygonHash],
    account,
    chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return c.json({ hash, confirmed: receipt.status === 'success' });
});

relay.post('/start-season', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { durationSeconds } = body;
  if (durationSeconds === undefined) {
    return c.json({ error: 'Missing required field: durationSeconds' }, 400);
  }

  const wallet = getRelayerWallet();
  const publicClient = getRelayerPublicClient();
  const contract = getContract('seasonManager');
  const chain = resolveChain();
  const account = wallet.account!.address;

  const hash = await wallet.writeContract({
    ...contract,
    functionName: 'startSeason',
    args: [BigInt(Math.round(durationSeconds))],
    account,
    chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return c.json({ hash, confirmed: receipt.status === 'success' });
});
