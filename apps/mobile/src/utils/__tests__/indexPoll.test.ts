import { describe, expect, it, vi } from 'vitest';
import { type IndexPollDeps, POLL_DELAYS_MS, pollUntilIndexed } from '@/utils/indexPoll';

function setup(visible: Array<boolean | null | Error>, online = true) {
  const t = { v: 0 };
  let i = 0;
  const reader = {
    isVisible: vi.fn(async () => {
      const r = visible[Math.min(i++, visible.length - 1)];
      if (r instanceof Error) throw r;
      return r === undefined ? false : r;
    }),
  };
  const deps: IndexPollDeps = {
    reader,
    clock: { now: () => t.v },
    sleep: vi.fn(async (ms: number) => {
      t.v += ms;
    }),
    isOnline: async () => online,
  };
  return { deps, reader, t };
}

describe('pollUntilIndexed', () => {
  it('finds it on the 3rd try', async () => {
    const { deps, reader } = setup([false, false, true]);
    const r = await pollUntilIndexed('0xh', 'o', new AbortController().signal, deps);
    expect(reader.isVisible).toHaveBeenCalledTimes(3);
    expect(r).toEqual({
      outcome: 'found',
      at: (POLL_DELAYS_MS[0] ?? 0) + (POLL_DELAYS_MS[1] ?? 0),
    });
  });

  it('gives up after 12 tries within about a minute', async () => {
    const { deps, reader, t } = setup([false]);
    const r = await pollUntilIndexed('0xh', 'o', new AbortController().signal, deps);
    expect(r.outcome).toBe('gave_up');
    expect(reader.isVisible).toHaveBeenCalledTimes(12);
    expect(t.v).toBeLessThanOrEqual(60_000);
  });

  it('treats a failed read as not yet', async () => {
    const { deps } = setup([new Error('x'), true]);
    const r = await pollUntilIndexed('0xh', 'o', new AbortController().signal, deps);
    expect(r.outcome).toBe('found');
  });

  it('does not poll offline', async () => {
    const { deps, reader } = setup([true], false);
    const r = await pollUntilIndexed('0xh', 'o', new AbortController().signal, deps);
    expect(r.outcome).toBe('offline');
    expect(reader.isVisible).not.toHaveBeenCalled();
  });

  it('stops when there is no index', async () => {
    const { deps } = setup([null]);
    const r = await pollUntilIndexed('0xh', 'o', new AbortController().signal, deps);
    expect(r.outcome).toBe('unavailable');
  });

  it('stops when cancelled', async () => {
    const { deps, reader } = setup([false]);
    const c = new AbortController();
    deps.sleep = async () => c.abort();
    const r = await pollUntilIndexed('0xh', 'o', c.signal, deps);
    expect(r.outcome).toBe('cancelled');
    expect(reader.isVisible).toHaveBeenCalledTimes(1);
  });
});
