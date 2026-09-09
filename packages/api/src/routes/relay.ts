import { Hono } from 'hono';
import type { Abi } from 'viem';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { RELAY_ABIS } from '../lib/relayAbis.js';
import { getRelayerPublicClient, getRelayerWallet } from '../lib/relayer.js';

export const relay = new Hono();

function getContract(name: string): { address: `0x${string}`; abi: Abi } {
  const config = getRelayChainConfig();
  const address = config.contracts[name];
  const abi = RELAY_ABIS[name as keyof typeof RELAY_ABIS] as Abi;
  if (!address || !abi) throw new Error(`[relay] Unknown contract: ${name}`);
  return { address, abi };
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
  const chain = getRelayChainConfig().chain;
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
  const chain = getRelayChainConfig().chain;
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
  const chain = getRelayChainConfig().chain;
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
  const chain = getRelayChainConfig().chain;
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
