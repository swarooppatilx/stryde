import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_POST_LENGTH as SHARED_MAX_LENGTH,
  MAX_POST_PHOTOS as SHARED_MAX_PHOTOS,
  postTypedData as sharedTypedData,
} from '../../../../shared/src/services/postIntent.js';
import { createPostVerifier, postTypedData } from '../postIntent.js';
import { MAX_PHOTOS, MAX_POST_LENGTH, type PostIntent } from '../posts.js';

const account = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const CHAIN_ID = 11155111;
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const intent: PostIntent = {
  author: account.address.toLowerCase() as `0x${string}`,
  action: 'create',
  text: 'Great run this morning',
  photos: [CID],
  postId: '',
  clientId: 'client-1',
  deadline: 2_000_000,
};

const eoaClient = {
  verifyTypedData: (params: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(params),
};
const verifier = () => createPostVerifier(eoaClient as never, CHAIN_ID);

describe('post limits', () => {
  it('are the same in the app and the API', () => {
    expect(MAX_POST_LENGTH).toBe(SHARED_MAX_LENGTH);
    expect(MAX_PHOTOS).toBe(SHARED_MAX_PHOTOS);
  });
});

describe('post intent typed data', () => {
  it('is identical to what the app signs (packages/shared)', () => {
    expect(postTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
  });
});

describe('createPostVerifier', () => {
  it('accepts a signature the app produced with the shared typed data', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verifier()(intent, signature)).toBe(true);
  });

  it('rejects a signature made by another wallet', async () => {
    const other = privateKeyToAccount(`0x${'33'.repeat(32)}`);
    const signature = await other.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verifier()(intent, signature)).toBe(false);
  });

  it('rejects a signed post replayed as a delete, or with other text, photos or id', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));
    const verify = verifier();

    expect(await verify({ ...intent, action: 'delete' }, signature)).toBe(false);
    expect(await verify({ ...intent, text: 'something else' }, signature)).toBe(false);
    expect(await verify({ ...intent, photos: [] }, signature)).toBe(false);
    expect(await verify({ ...intent, postId: 'abc' }, signature)).toBe(false);
    expect(await verify({ ...intent, clientId: 'client-2' }, signature)).toBe(false);
  });

  it('rejects a signature made for another chain', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, 1));

    expect(await verifier()(intent, signature)).toBe(false);
  });

  it('treats a malformed signature or a failing check as "not verified"', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };

    expect(await createPostVerifier(broken as never, CHAIN_ID)(intent, '0xnope')).toBe(false);
  });

  it('lets a failing check (an RPC outage) surface instead of reporting a bad signature', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };
    const validLooking = `0x${'11'.repeat(65)}`;

    await expect(
      createPostVerifier(broken as never, CHAIN_ID)(intent, validLooking)
    ).rejects.toThrow('rpc down');
  });
});
