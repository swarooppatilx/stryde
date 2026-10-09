import { describe, expect, it, vi } from 'vitest';
import { retryWithBackoff } from '@/utils/retry';

const sleeps = () => {
  const calls: number[] = [];
  return { calls, sleep: async (ms: number) => void calls.push(ms) };
};

describe('retryWithBackoff', () => {
  it('returns straight away when the first attempt works', async () => {
    const { calls, sleep } = sleeps();
    const fn = vi.fn().mockResolvedValue('ok');

    expect(await retryWithBackoff(fn, { retries: 5, baseMs: 500, sleep })).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
    expect(calls).toEqual([]);
  });

  it('waits longer after each failure until it succeeds', async () => {
    const { calls, sleep } = sleeps();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValue('third time');

    expect(await retryWithBackoff(fn, { retries: 5, baseMs: 500, sleep })).toBe('third time');
    expect(calls).toEqual([500, 1000]);
  });

  it("gives up after the last attempt and throws that attempt's error, without a pointless final wait", async () => {
    const { calls, sleep } = sleeps();
    let n = 0;
    const fn = vi.fn().mockImplementation(async () => {
      throw new Error(`failure ${++n}`);
    });

    await expect(retryWithBackoff(fn, { retries: 4, baseMs: 100, sleep })).rejects.toThrow(
      'failure 4'
    );
    expect(fn).toHaveBeenCalledTimes(4);
    expect(calls).toEqual([100, 200, 400]);
  });

  it('a single attempt never waits', async () => {
    const { calls, sleep } = sleeps();

    await expect(
      retryWithBackoff(() => Promise.reject(new Error('x')), { retries: 1, baseMs: 100, sleep })
    ).rejects.toThrow('x');
    expect(calls).toEqual([]);
  });
});
