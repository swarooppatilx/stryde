import { createPublicClient, createWalletClient, type Hex, http, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  activityRegistryAbi,
  challengeRegistryAbi,
  moveToEarnTokenAbi,
} from '../../../../shared/src/abis';
import { getRelayChainConfig } from '../../lib/chainConfig.js';
import { relay } from '../relay.js';

/**
 * The relay routes against a real chain: the settlement and reward rules the contracts enforce
 * (only the settler may settle, the winner is the one who ran further, a reward is for an activity
 * the athlete really recorded) checked end to end, not against mocks of viem.
 */

const rpcUrl = process.env.RELAYER_RPC_URL ?? 'http://127.0.0.1:8545';
const chainConfig = getRelayChainConfig();
const deployed = chainConfig.contracts as Record<string, `0x${string}` | undefined>;
// A missing address would otherwise reach viem as `undefined` and fail as a confusing ABI error.
const need = (name: string): `0x${string}` => {
  const address = deployed[name];
  if (!address) throw new Error(`No ${name} address for the anvil chain; run deploy-local first`);
  return address;
};
const contracts = {
  activityRegistry: need('activityRegistry'),
  challengeRegistry: need('challengeRegistry'),
  moveToEarnToken: need('moveToEarnToken'),
};
const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });

async function rpc(method: string, params: unknown[] = []) {
  await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

/** A fresh athlete with plenty of test ETH. */
async function athlete() {
  const account = privateKeyToAccount(generatePrivateKey());
  await rpc('anvil_setBalance', [account.address, '0x56BC75E2D63100000']);
  const wallet = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });
  return { account, wallet, address: account.address };
}

type Athlete = Awaited<ReturnType<typeof athlete>>;

async function send(who: Athlete, request: Parameters<Athlete['wallet']['writeContract']>[0]) {
  const hash = await who.wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`reverted: ${request.functionName}`);
  return receipt;
}

let counter = 0;
const uniqueHash = (): Hex => `0x${(Date.now() + counter++).toString(16).padStart(64, '0')}`;

async function record(who: Athlete, distance: bigint, hash: Hex = uniqueHash()) {
  await send(who, {
    address: contracts.activityRegistry,
    abi: activityRegistryAbi,
    functionName: 'recordActivity',
    args: [hash, 0, distance, 600n, 0n],
  } as never);
  return hash;
}

const post = (path: string, body: unknown) =>
  relay.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** A run challenge from `a` to `b`, accepted, with a short deadline. */
async function openChallenge(a: Athlete, b: Athlete, durationSeconds = 3_600) {
  const stake = parseEther('0.01');
  await send(a, {
    address: contracts.challengeRegistry,
    abi: challengeRegistryAbi,
    functionName: 'createChallenge',
    args: [b.address, 0, 5000n, BigInt(durationSeconds)],
    value: stake,
  } as never);
  const count = (await publicClient.readContract({
    address: contracts.challengeRegistry,
    abi: challengeRegistryAbi,
    functionName: 'getChallengeCount',
  })) as bigint;
  await send(b, {
    address: contracts.challengeRegistry,
    abi: challengeRegistryAbi,
    functionName: 'acceptChallenge',
    args: [count],
    value: stake,
  } as never);
  return count;
}

async function challengeOf(id: bigint) {
  return (await publicClient.readContract({
    address: contracts.challengeRegistry,
    abi: challengeRegistryAbi,
    functionName: 'getChallenge',
    args: [id],
  })) as { status: number; winner: `0x${string}` };
}

const SETTLED = 2;

beforeAll(async () => {
  const code = await publicClient.getCode({ address: contracts.challengeRegistry });
  if (!code || code === '0x') throw new Error('Contracts are not deployed on this chain');
});

describe('POST /settle-challenge on a real chain', () => {
  it('pays whoever ran further, once the chain’s own clock is past the deadline', async () => {
    const [a, b] = [await athlete(), await athlete()];
    const id = await openChallenge(a, b);
    await record(a, 2_000n);
    await record(b, 6_000n);

    const early = await post('/settle-challenge', { challengeId: id.toString() });
    expect(early.status).toBe(409); // not over yet

    await rpc('evm_increaseTime', [3_700]);
    await rpc('evm_mine');
    const response = await post('/settle-challenge', { challengeId: id.toString() });

    expect(response.status).toBe(200);
    const settled = await challengeOf(id);
    expect(settled.status).toBe(SETTLED);
    expect(settled.winner.toLowerCase()).toBe(b.address.toLowerCase());
  });

  it('refuses a tie, so nobody is paid by a coin flip', async () => {
    const [a, b] = [await athlete(), await athlete()];
    const id = await openChallenge(a, b);
    await record(a, 3_000n);
    await record(b, 3_000n);
    await rpc('evm_increaseTime', [3_700]);
    await rpc('evm_mine');

    const response = await post('/settle-challenge', { challengeId: id.toString() });

    expect(response.status).toBe(409);
    expect((await challengeOf(id)).status).not.toBe(SETTLED);
  });

  it('does not count runs recorded after the deadline', async () => {
    const [a, b] = [await athlete(), await athlete()];
    const id = await openChallenge(a, b);
    await record(a, 2_000n);
    await rpc('evm_increaseTime', [3_700]);
    await rpc('evm_mine');
    await record(b, 50_000n); // too late to count

    const response = await post('/settle-challenge', { challengeId: id.toString() });

    expect(response.status).toBe(200);
    expect((await challengeOf(id)).winner.toLowerCase()).toBe(a.address.toLowerCase());
  });

  it('answers 404 for a challenge that never existed', async () => {
    const response = await post('/settle-challenge', { challengeId: '999999999' });

    expect(response.status).toBe(404);
  });

  it('cannot settle an already settled challenge a second time', async () => {
    const [a, b] = [await athlete(), await athlete()];
    const id = await openChallenge(a, b);
    await record(a, 1_000n);
    await rpc('evm_increaseTime', [3_700]);
    await rpc('evm_mine');
    expect((await post('/settle-challenge', { challengeId: id.toString() })).status).toBe(200);

    const again = await post('/settle-challenge', { challengeId: id.toString() });

    expect(again.status).toBe(409);
  });
});

describe('the contracts only let the relayer settle', () => {
  it('rejects an athlete naming themselves the winner', async () => {
    const [a, b] = [await athlete(), await athlete()];
    const id = await openChallenge(a, b);
    await rpc('evm_increaseTime', [3_700]);
    await rpc('evm_mine');

    await expect(
      send(a, {
        address: contracts.challengeRegistry,
        abi: challengeRegistryAbi,
        functionName: 'settleChallenge',
        args: [id, a.address],
      } as never)
    ).rejects.toThrow();
    expect((await challengeOf(id)).status).not.toBe(SETTLED);
  });
});

describe('POST /mint-reward on a real chain', () => {
  const balanceOf = (who: Athlete) =>
    publicClient.readContract({
      address: contracts.moveToEarnToken,
      abi: moveToEarnTokenAbi,
      functionName: 'balanceOf',
      args: [who.address],
    }) as Promise<bigint>;

  it('rewards the distance the athlete really recorded', async () => {
    const a = await athlete();
    const hash = await record(a, 4_000n);

    const response = await post('/mint-reward', {
      recipient: a.address,
      activityHash: hash,
      distance: 4_000,
    });

    expect(response.status).toBe(200);
    expect(await balanceOf(a)).toBeGreaterThan(0n);
  });

  it('refuses to reward someone who did not record that activity', async () => {
    const [a, thief] = [await athlete(), await athlete()];
    const hash = await record(a, 4_000n);

    const response = await post('/mint-reward', {
      recipient: thief.address,
      activityHash: hash,
      distance: 4_000,
    });

    expect(response.status).toBe(403);
    expect(await balanceOf(thief)).toBe(0n);
  });

  it('refuses a second reward for the same activity', async () => {
    const a = await athlete();
    const hash = await record(a, 4_000n);
    const body = { recipient: a.address, activityHash: hash, distance: 4_000 };
    expect((await post('/mint-reward', body)).status).toBe(200);
    const before = await balanceOf(a);

    const again = await post('/mint-reward', body);

    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(await balanceOf(a)).toBe(before);
  });

  it('caps the reward at what was recorded, whatever distance the caller claims', async () => {
    const a = await athlete();
    const hash = await record(a, 1_000n);

    await post('/mint-reward', { recipient: a.address, activityHash: hash, distance: 1_000 });

    const small = await balanceOf(a);
    const b = await athlete();
    const bigHash = await record(b, 1_000n);
    await post('/mint-reward', { recipient: b.address, activityHash: bigHash, distance: 90_000 });
    expect(await balanceOf(b)).toBe(small);
  });
});
