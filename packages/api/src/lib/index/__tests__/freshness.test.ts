import { describe, expect, it, vi } from 'vitest';
import { createFreshness } from '../freshness.js';

const make = (run: () => Promise<{ block: bigint }>, ttlMs = 30_000) => {
  let now = 1_000_000;
  const fresh = createFreshness({ run, ttlMs, now: () => now });
  return { fresh, advance: (ms: number) => (now += ms) };
};

describe('createFreshness', () => {
  it('syncs on the first read and reports the block it reached', async () => {
    const run = vi.fn(async () => ({ block: 42n }));
    const { fresh } = make(run);

    expect(await fresh.ensure()).toEqual({ syncedBlock: '42', stale: false });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not sync again inside the window', async () => {
    const run = vi.fn(async () => ({ block: 1n }));
    const { fresh, advance } = make(run);
    await fresh.ensure();

    advance(29_000);
    await fresh.ensure();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('syncs again once the window has passed', async () => {
    const run = vi.fn(async () => ({ block: 1n }));
    const { fresh, advance } = make(run);
    await fresh.ensure();

    advance(31_000);
    await fresh.ensure();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('shares one sync between readers that arrive together', async () => {
    let release: (v: { block: bigint }) => void = () => {};
    const run = vi.fn(() => new Promise<{ block: bigint }>((resolve) => (release = resolve)));
    const { fresh } = make(run);

    const readers = Promise.all([fresh.ensure(), fresh.ensure(), fresh.ensure()]);
    release({ block: 7n });
    await readers;

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never throws into a read: a failed sync serves what there is and says it is stale', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ block: 5n })
      .mockRejectedValueOnce(new Error('rabdi down'));
    const { fresh, advance } = make(run);
    await fresh.ensure();

    advance(31_000);
    const result = await fresh.ensure();

    expect(result).toEqual({ syncedBlock: '5', stale: true });
  });

  it('says there is no synced block yet when the very first sync failed', async () => {
    const { fresh } = make(async () => {
      throw new Error('no key');
    });

    expect(await fresh.ensure()).toEqual({ syncedBlock: null, stale: true });
  });

  it('retries sooner after a failure than after a success, but not on every read', async () => {
    const run = vi.fn().mockRejectedValue(new Error('down'));
    const { fresh, advance } = make(run);
    await fresh.ensure();

    advance(1_000);
    await fresh.ensure();
    expect(run).toHaveBeenCalledTimes(1);

    advance(6_000);
    await fresh.ensure();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('syncs now when forced, whatever the window says', async () => {
    const run = vi.fn(async () => ({ block: 9n }));
    const { fresh } = make(run);
    await fresh.ensure();

    const result = await fresh.force();

    expect(run).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ block: 9n });
  });
});
