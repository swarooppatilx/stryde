import { describe, expect, it, vi } from 'vitest';
import { readUntil, retryWithBackoff } from '@/utils/retry';

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

describe('readUntil', () => {
  const noSleep = async () => {};

  it('returns the first answer that satisfies the condition', async () => {
    const read = vi.fn().mockResolvedValueOnce('open').mockResolvedValueOnce('accepted');

    const result = await readUntil(read, (v) => v === 'accepted', {
      tries: 5,
      delayMs: 0,
      sleep: noSleep,
    });

    expect(result).toBe('accepted');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('gives back the last answer when the condition never holds, after exactly `tries` reads', async () => {
    const read = vi.fn().mockResolvedValue('open');

    const result = await readUntil(read, (v) => v === 'accepted', {
      tries: 4,
      delayMs: 0,
      sleep: noSleep,
    });

    expect(result).toBe('open');
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('treats a failed read as "not yet" and keeps trying', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('node behind'))
      .mockResolvedValueOnce('accepted');

    const result = await readUntil(read, (v) => v === 'accepted', {
      tries: 3,
      delayMs: 0,
      sleep: noSleep,
    });

    expect(result).toBe('accepted');
  });

  it('pauses between reads but not after the last one', async () => {
    const waits: number[] = [];

    await readUntil(
      async () => 'open',
      () => false,
      {
        tries: 3,
        delayMs: 250,
        sleep: async (ms) => {
          waits.push(ms);
        },
      }
    );

    expect(waits).toEqual([250, 250]);
  });

  it('rethrows when every read failed, since there is no answer to hand back', async () => {
    const read = vi.fn().mockRejectedValue(new Error('rpc down'));

    await expect(
      readUntil(read, () => true, { tries: 2, delayMs: 0, sleep: noSleep })
    ).rejects.toThrow('rpc down');
  });
});
