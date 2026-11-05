import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import { commentLikeTypedData as sharedTypedData } from '../../../../shared/src/services/commentLikeIntent.js';
import { commentLikeTypedData, createCommentLikeVerifier } from '../commentLikeIntent.js';

const account = privateKeyToAccount(`0x${'55'.repeat(32)}`);
const CHAIN_ID = 11155111;
const intent = {
  liker: account.address.toLowerCase() as `0x${string}`,
  commentId: `0x${'11'.repeat(32)}` as `0x${string}`,
  action: 'like' as const,
  deadline: 2_000_000,
};
const eoaClient = {
  verifyTypedData: (params: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(params),
};

describe('comment like typed data', () => {
  it('is identical to what the app signs (packages/shared)', () => {
    expect(commentLikeTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
  });
});

describe('createCommentLikeVerifier', () => {
  const verify = createCommentLikeVerifier(eoaClient as never, CHAIN_ID);

  it('accepts a signature the app produced with the shared typed data', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verify(intent, signature)).toBe(true);
  });

  it('rejects a signature made by another wallet', async () => {
    const other = privateKeyToAccount(`0x${'66'.repeat(32)}`);

    expect(await verify(intent, await other.signTypedData(sharedTypedData(intent, CHAIN_ID)))).toBe(
      false
    );
  });

  it('rejects a signature for a different action, so a like cannot be replayed as an unlike', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verify({ ...intent, action: 'unlike' }, signature)).toBe(false);
  });

  it('rejects a signature for a different comment', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verify({ ...intent, commentId: `0x${'22'.repeat(32)}` }, signature)).toBe(false);
  });

  it('treats garbage as a failed check rather than an error', async () => {
    expect(await verify(intent, '0xnot-a-signature')).toBe(false);
  });

  it('lets a failing check (an RPC outage) surface instead of reporting a bad signature', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };
    const validLooking = `0x${'11'.repeat(65)}`;

    await expect(
      createCommentLikeVerifier(broken as never, CHAIN_ID)(intent, validLooking)
    ).rejects.toThrow('rpc down');
  });
});
