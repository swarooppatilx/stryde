import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { accountDeleteTypedData as sharedTypedData } from '../../../../shared/src/services/accountDeleteIntent.js';
import { accountDeleteTypedData, createAccountDeleteVerifier } from '../accountDeleteIntent.js';

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const CHAIN_ID = 11155111;
const intent = { owner: account.address.toLowerCase() as `0x${string}`, deadline: 2_000_000 };
const eoaClient = {
  verifyTypedData: (params: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(params),
};

describe('account delete intent', () => {
  it('is identical to what the app signs (packages/shared)', () => {
    expect(accountDeleteTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
  });

  it('accepts the owner’s signature and rejects another wallet’s', async () => {
    const verify = createAccountDeleteVerifier(eoaClient as never, CHAIN_ID);
    const mine = await account.signTypedData(sharedTypedData(intent, CHAIN_ID));
    const other = await privateKeyToAccount(`0x${'55'.repeat(32)}`).signTypedData(
      sharedTypedData(intent, CHAIN_ID)
    );

    expect(await verify(intent, mine)).toBe(true);
    expect(await verify(intent, other)).toBe(false);
  });

  it('rejects a signature made for another chain, or not hex at all', async () => {
    const verify = createAccountDeleteVerifier(eoaClient as never, CHAIN_ID);
    const elsewhere = await account.signTypedData(sharedTypedData(intent, 1));

    expect(await verify(intent, elsewhere)).toBe(false);
    expect(await verify(intent, 'not-hex')).toBe(false);
  });
});
