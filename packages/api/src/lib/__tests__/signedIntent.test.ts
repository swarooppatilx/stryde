import { describe, expect, it, vi } from 'vitest';
import { createIntentVerifier, socialDomain } from '../signedIntent.js';

const OWNER = `0x${'a'.repeat(40)}` as const;
const SIG = `0x${'ab'.repeat(65)}` as const;

interface Ping {
  owner: `0x${string}`;
  deadline: number;
}
const typedData = (intent: Ping, chainId: number) => ({
  domain: socialDomain(chainId),
  types: { Ping: [{ name: 'owner', type: 'address' }] } as const,
  primaryType: 'Ping' as const,
  message: { owner: intent.owner, deadline: BigInt(intent.deadline) },
});

describe('socialDomain', () => {
  it('is the one EIP-712 domain every social intent is signed under, bound to the chain', () => {
    expect(socialDomain(11155111)).toEqual({
      name: 'Stryde Social',
      version: '1',
      chainId: 11155111,
    });
  });
});

describe('createIntentVerifier', () => {
  const verifierFor = (client: { verifyTypedData: ReturnType<typeof vi.fn> }) =>
    createIntentVerifier(typedData, (i: Ping) => i.owner)(client as never, 11155111);

  it('asks the chain client whether the named signer signed exactly this typed data', async () => {
    const client = { verifyTypedData: vi.fn().mockResolvedValue(true) };

    const ok = await verifierFor(client)({ owner: OWNER, deadline: 100 }, SIG);

    expect(ok).toBe(true);
    expect(client.verifyTypedData).toHaveBeenCalledWith({
      address: OWNER,
      signature: SIG,
      ...typedData({ owner: OWNER, deadline: 100 }, 11155111),
    });
  });

  it('returns false for text that is not even hex, without calling the chain', async () => {
    const client = { verifyTypedData: vi.fn() };
    expect(await verifierFor(client)({ owner: OWNER, deadline: 100 }, 'not-hex')).toBe(false);
    expect(client.verifyTypedData).not.toHaveBeenCalled();
  });

  it('returns false when the signature does not match', async () => {
    const client = { verifyTypedData: vi.fn().mockResolvedValue(false) };
    expect(await verifierFor(client)({ owner: OWNER, deadline: 100 }, SIG)).toBe(false);
  });

  it('lets a chain outage surface instead of calling it a bad signature', async () => {
    const outage = new Error('rpc down');
    const client = { verifyTypedData: vi.fn().mockRejectedValue(outage) };
    await expect(verifierFor(client)({ owner: OWNER, deadline: 100 }, SIG)).rejects.toThrow(outage);
  });
});
