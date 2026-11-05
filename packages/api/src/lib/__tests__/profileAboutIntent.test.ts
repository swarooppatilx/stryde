import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_BIO_LENGTH as SHARED_MAX_BIO,
  MAX_LOCATION_LENGTH as SHARED_MAX_LOCATION,
  aboutTypedData as sharedTypedData,
} from '../../../../shared/src/services/profileAboutIntent.js';
import { MAX_BIO_LENGTH, MAX_LOCATION_LENGTH } from '../profileAbout.js';
import { aboutTypedData, createAboutVerifier } from '../profileAboutIntent.js';

const account = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const CHAIN_ID = 11155111;
const intent = {
  author: account.address.toLowerCase() as `0x${string}`,
  bio: 'Trail runner. Coffee first.',
  location: 'Pune, India',
  deadline: 2_000_000,
};

const eoaClient = {
  verifyTypedData: (params: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(params),
};

describe('about limits', () => {
  it('are the same in the app and the API', () => {
    expect(MAX_BIO_LENGTH).toBe(SHARED_MAX_BIO);
    expect(MAX_LOCATION_LENGTH).toBe(SHARED_MAX_LOCATION);
  });
});

describe('about intent typed data', () => {
  it('is identical to what the app signs (packages/shared)', () => {
    expect(aboutTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
  });
});

describe('createAboutVerifier', () => {
  it('accepts a signature the app produced with the shared typed data', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await createAboutVerifier(eoaClient as never, CHAIN_ID)(intent, signature)).toBe(true);
  });

  it('rejects a signature made by another wallet', async () => {
    const other = privateKeyToAccount(`0x${'33'.repeat(32)}`);
    const signature = await other.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await createAboutVerifier(eoaClient as never, CHAIN_ID)(intent, signature)).toBe(false);
  });

  it('rejects a signature reused for different text, so a signed bio cannot be swapped', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));
    const verify = createAboutVerifier(eoaClient as never, CHAIN_ID);

    expect(await verify({ ...intent, bio: 'something else' }, signature)).toBe(false);
    expect(await verify({ ...intent, location: 'elsewhere' }, signature)).toBe(false);
  });

  it('rejects a signature made for another chain', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, 1));

    expect(await createAboutVerifier(eoaClient as never, CHAIN_ID)(intent, signature)).toBe(false);
  });

  it('treats a malformed signature or a failing check as "not verified"', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };

    expect(await createAboutVerifier(broken as never, CHAIN_ID)(intent, '0xnope')).toBe(false);
  });

  it('lets a failing check (an RPC outage) surface instead of reporting a bad signature', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };
    const validLooking = `0x${'11'.repeat(65)}`;

    await expect(
      createAboutVerifier(broken as never, CHAIN_ID)(intent, validLooking)
    ).rejects.toThrow('rpc down');
  });
});
