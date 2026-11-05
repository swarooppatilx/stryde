import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import { reportTypedData as sharedTypedData } from '../../../../shared/src/services/reportIntent.js';
import { createReportVerifier, reportTypedData } from '../reportIntent.js';

const account = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const CHAIN_ID = 11155111;
const intent = {
  reporter: account.address.toLowerCase() as `0x${string}`,
  targetKind: 'comment' as const,
  targetId: '0xc0ffee',
  reason: 'spam' as const,
  note: 'sells things',
  deadline: 2_000_000,
};

const eoaClient = {
  verifyTypedData: (params: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(params),
};

describe('report intent typed data', () => {
  it('is identical to what the app signs (packages/shared)', () => {
    expect(reportTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
  });
});

describe('createReportVerifier', () => {
  const verify = createReportVerifier(eoaClient as never, CHAIN_ID);

  it('accepts a signature the app produced with the shared typed data', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verify(intent, signature)).toBe(true);
  });

  it('rejects a signature made by another wallet', async () => {
    const other = privateKeyToAccount(`0x${'33'.repeat(32)}`);
    const signature = await other.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verify(intent, signature)).toBe(false);
  });

  it.each([
    ['target', { targetId: '0xbeef' }],
    ['reason', { reason: 'abusive' as const }],
    ['note', { note: 'something else' }],
  ])('rejects a report whose %s differs from what was signed', async (_name, change) => {
    const signature = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));

    expect(await verify({ ...intent, ...change }, signature)).toBe(false);
  });

  it('rejects a signature made for another chain', async () => {
    const signature = await account.signTypedData(sharedTypedData(intent, 1));

    expect(await verify(intent, signature)).toBe(false);
  });

  it('treats a malformed signature or a failing check as "not verified"', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };

    expect(await createReportVerifier(broken as never, CHAIN_ID)(intent, '0xnope')).toBe(false);
  });

  it('lets a failing check (an RPC outage) surface instead of reporting a bad signature', async () => {
    const broken = { verifyTypedData: vi.fn().mockRejectedValue(new Error('rpc down')) };
    const validLooking = `0x${'11'.repeat(65)}`;

    await expect(
      createReportVerifier(broken as never, CHAIN_ID)(intent, validLooking)
    ).rejects.toThrow('rpc down');
  });
});
