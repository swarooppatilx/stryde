import { describe, expect, it, vi } from 'vitest';
import { devSelfieCheck } from '@/backends/sandbox/devSelfieCheck';

describe('devSelfieCheck', () => {
  it('verifies without opening the World app, after a short wait so the screen shows progress', async () => {
    const wait = vi.fn(async () => {});

    const result = await devSelfieCheck('0x00000000000000000000000000000000000000aa', wait);

    expect(wait).toHaveBeenCalledTimes(1);
    expect(result.nullifier).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.proof).toEqual({ responses: [] });
  });

  it('gives the same nullifier for the same wallet and different ones for different wallets', async () => {
    const wait = async () => {};
    const a1 = await devSelfieCheck('0xaa', wait);
    const a2 = await devSelfieCheck('0xaa', wait);
    const b = await devSelfieCheck('0xbb', wait);

    expect(a1.nullifier).toBe(a2.nullifier);
    expect(a1.nullifier).not.toBe(b.nullifier);
  });
});
