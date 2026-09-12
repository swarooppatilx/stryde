import type { Context } from 'hono';
import { Hono } from 'hono';
import type { Abi } from 'viem';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { RELAY_ABIS } from '../lib/relayAbis.js';
import { getRelayerPublicClient, getRelayerWallet } from '../lib/relayer.js';

const API_KEY = process.env.API_KEY;

function requireApiKey(c: Context) {
  const key = c.req.header('x-api-key');
  if (!API_KEY || key !== API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return undefined;
}

export const relay = new Hono();

function getContract(name: string): { address: `0x${string}`; abi: Abi } {
  const config = getRelayChainConfig();
  const address = config.contracts[name];
  const abi = RELAY_ABIS[name as keyof typeof RELAY_ABIS] as Abi;
  if (!address || !abi) throw new Error(`[relay] Unknown contract: ${name}`);
  return { address, abi };
}

// Map the failure modes of the write side of a relayed call (which always
// uses the shared relayer account) onto stable HTTP status codes instead of
// leaking a raw viem stack / 500. Match on the message text viem builds from
// decoded revert data and its own error codes — deliberately lenient so new
// custom errors on the same contracts keep getting a sane response.
function mapRelayError(c: Context, error: unknown) {
  if (!(error instanceof Error)) {
    console.error('[relay] Non-Error thrown:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
  const text = error.message;

  if (/SeasonAlreadyActive|season is (already )?active/i.test(text)) {
    return c.json({ error: 'A season is already active. End it before starting another.' }, 409);
  }
  if (/OwnableUnauthorizedAccount|caller is not the owner|onlyOwner|not the owner/i.test(text)) {
    return c.json({ error: 'Relayer is not authorized to perform this action' }, 403);
  }
  if (/insufficient funds|InsufficientFunds/i.test(text)) {
    return c.json({ error: 'Relayer wallet has insufficient funds for gas' }, 402);
  }
  if (/missing env var|not configured|misconfigured/i.test(text)) {
    return c.json({ error: 'Service misconfigured' }, 503);
  }
  console.error('[relay] Unmapped error:', error);
  return c.json({ error: 'Relay transaction failed' }, 400);
}

// Wraps the write+confirm block of a relayed call: anything that throws is
// mapped via mapRelayError and the response short-circuits.
function runRelayWrite(c: Context, fn: () => Promise<{ hash: `0x${string}`; confirmed: boolean }>) {
  return Promise.resolve()
    .then(() => fn())
    .then((result) => c.json(result))
    .catch((error: unknown) => mapRelayError(c, error));
}

relay.post('/mint-achievement', async (c) => {
  const auth = requireApiKey(c);
  if (auth) return auth;
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
  const account = wallet.account!;

  return runRelayWrite(c, async () => {
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

    return { hash: mintHash, confirmed: receipt.status === 'success' };
  });
});

relay.post('/mint-reward', async (c) => {
  const auth = requireApiKey(c);
  if (auth) return auth;
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
  const account = wallet.account!;

  return runRelayWrite(c, async () => {
    const hash = await wallet.writeContract({
      ...contract,
      functionName: 'mintForActivity',
      args: [recipient, activityHash, BigInt(Math.round(distance))],
      account,
      chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return { hash, confirmed: receipt.status === 'success' };
  });
});

relay.post('/mint-territory-nft', async (c) => {
  const auth = requireApiKey(c);
  if (auth) return auth;
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
  const account = wallet.account!;

  return runRelayWrite(c, async () => {
    const hash = await wallet.writeContract({
      ...contract,
      functionName: 'mintTerritory',
      args: [recipient, polygonHash],
      account,
      chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return { hash, confirmed: receipt.status === 'success' };
  });
});

relay.post('/start-season', async (c) => {
  const auth = requireApiKey(c);
  if (auth) return auth;
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
  const account = wallet.account!;

  return runRelayWrite(c, async () => {
    const hash = await wallet.writeContract({
      ...contract,
      functionName: 'startSeason',
      args: [BigInt(Math.round(durationSeconds))],
      account,
      chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return { hash, confirmed: receipt.status === 'success' };
  });
});
