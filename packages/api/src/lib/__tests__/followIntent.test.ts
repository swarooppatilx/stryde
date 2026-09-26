import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import { followTypedData as sharedTypedData } from '../../../../shared/src/services/followIntent.js';
import { createFollowVerifier, followTypedData } from '../followIntent.js';

const account = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const CHAIN_ID = 11155111;
const intent = {
  follower: account.address.toLowerCase() as `0x${string}`,
  followee: THEM,
  action: 'follow' as const,
  deadline: 2_000_000,
};

const eoaClient = {
  verifyTypedData: (params: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(params),
};

describe('follow intent typed data', () => {
  it('is identical to what the app signs (packages/shared)', () => {
    expect(followTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
  });
});

describe('createFollowVerifier', () => {
  it('accepts a signature the app produced with the shared typed data', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));
    const verify = createFollowVerifier(eoaClient as never, CHAIN_ID);

    expect(await verify(intent, signature)).toBe(true);
  });

  it('rejects a signature made by another wallet', async () => {
    const other = privateKeyToAccount(`0x${'33'.repeat(32)}`);
    const signature = await other.signTypedData(sharedTypedData(intent, CHAIN_ID));
    const verify = createFollowVerifier(eoaClient as never, CHAIN_ID);

    expect(await verify(intent, signature)).toBe(false);
  });

  it('rejects a signature for a different action, so a follow cannot be replayed as an unfollow', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));
    const verify = createFollowVerifier(eoaClient as never, CHAIN_ID);

    expect(await verify({ ...intent, action: 'unfollow' }, signature)).toBe(false);
  });

  it('rejects a signature made for another chain', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, 1));
    const verify = createFollowVerifier(eoaClient as never, CHAIN_ID);

    expect(await verify(intent, signature)).toBe(false);
  });

  it('treats a malformed signature or a failing check as "not verified"', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };

    expect(await createFollowVerifier(broken as never, CHAIN_ID)(intent, '0xnope')).toBe(false);
  });

  it('lets a failing check (an RPC outage) surface instead of reporting a bad signature', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };
    const validLooking = `0x${'11'.repeat(65)}`;

    await expect(
      createFollowVerifier(broken as never, CHAIN_ID)(intent, validLooking)
    ).rejects.toThrow('rpc down');
  });
});
