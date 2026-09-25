import { generatePrivateKey } from 'viem/accounts';
import { beforeAll, describe, expect, it } from 'vitest';
import { getChainConfig } from '../../constants';
import { getPublicClient, getWalletClient, setChainMode } from '../client';
import { createGroup, joinGroup, leaveGroup } from '../group';
import { register, setUsername } from '../profile';
import { addComment, computeCommentId, setKudos } from '../social';

/**
 * What the contracts really answer when a request is repeated. The app's offline queue retries
 * writes and treats a few specific reverts as "already done"; these tests keep that honest.
 */

const rpcUrl = getChainConfig('local').rpcUrl;

async function fundedWallet() {
  const wallet = getWalletClient(generatePrivateKey());
  const account = wallet.account;
  if (!account) throw new Error('wallet has no account');
  await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'anvil_setBalance',
      params: [account.address, '0x56BC75E2D63100000'],
    }),
  });
  return wallet;
}

/** The contract error name a failed call reverted with, however deep viem wrapped it. */
function revertName(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current instanceof Error; depth++) {
    if (current.name === 'ContractFunctionRevertedError') {
      const data = (current as { data?: { errorName?: string } }).data;
      return data?.errorName ?? '';
    }
    current = current.cause;
  }
  return null;
}

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to revert');
}

const unique = () => Math.random().toString(36).slice(2, 10);

beforeAll(async () => {
  setChainMode('local');
  try {
    await getPublicClient().getBlockNumber();
  } catch {
    throw new Error(`No chain at ${rpcUrl}. Start it with: yarn dev:local`);
  }
});

describe('kudos', () => {
  it('setKudos is safe to repeat: the second call sends nothing', async () => {
    const wallet = await fundedWallet();
    await register(wallet, `k_${unique()}`);

    const first = await setKudos(wallet, 1n, true);
    const second = await setKudos(wallet, 1n, true);
    const off = await setKudos(wallet, 1n, false);

    expect(first.changed).toBe(true);
    expect(second).toEqual({ changed: false });
    expect(off.changed).toBe(true);
  });
});

describe('comments', () => {
  it('a repeated comment id reverts with DuplicateComment', async () => {
    const wallet = await fundedWallet();
    await register(wallet, `c_${unique()}`);
    const id = computeCommentId(1n, wallet.account?.address ?? '0x', unique(), 1n);

    await addComment(wallet, 1n, id, 'bafy-one');
    const error = await failureOf(() => addComment(wallet, 1n, id, 'bafy-one'));

    expect(revertName(error)).toBe('DuplicateComment');
  });
});

describe('clubs', () => {
  it('joining twice reverts AlreadyMember, and leaving when not a member reverts NotMember', async () => {
    const owner = await fundedWallet();
    await register(owner, `o_${unique()}`);
    const { groupId } = await createGroup(owner, {
      name: `club ${unique()}`,
      location: 'Pune',
      description: 'test',
      sportType: 0,
    });
    const member = await fundedWallet();
    await register(member, `m_${unique()}`);

    await joinGroup(member, groupId);
    const again = await failureOf(() => joinGroup(member, groupId));
    await leaveGroup(member, groupId);
    const gone = await failureOf(() => leaveGroup(member, groupId));

    expect(revertName(again)).toBe('AlreadyMember');
    expect(revertName(gone)).toBe('NotMember');
  });
});

describe('usernames', () => {
  it('setting your own current name again reverts UsernameTaken, as does someone else’s', async () => {
    const name = `u_${unique()}`;
    const a = await fundedWallet();
    const b = await fundedWallet();
    await register(a, name);
    await register(b, `u_${unique()}`);

    const own = await failureOf(() => setUsername(a, name));
    const theirs = await failureOf(() => setUsername(b, name));

    expect(revertName(own)).toBe('UsernameTaken');
    expect(revertName(theirs)).toBe('UsernameTaken');
  });
});
