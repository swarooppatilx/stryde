import { describe, expect, it, vi } from 'vitest';
import { createActivitySummaryLoader } from '../activitySummaryLoader.js';

const ROUTE = '72.86,19.06;72.87,19.07;72.88,19.06';
const RING: Array<[number, number]> = [
  [72.86, 19.06],
  [72.87, 19.06],
  [72.87, 19.07],
  [72.86, 19.06],
];

describe('createActivitySummaryLoader', () => {
  it('returns what a card needs from the metadata a CID points at', async () => {
    const load = createActivitySummaryLoader({
      fetchJson: async () => ({
        name: 'Evening Run',
        description: 'felt good',
        photos: ['https://gw/ipfs/a', 'https://gw/ipfs/b'],
        polyline: ROUTE,
        territory: RING,
        coordinates: [[1, 2]],
      }),
    });
    expect(await load.summary('cid-a')).toEqual({
      name: 'Evening Run',
      description: 'felt good',
      photos: ['https://gw/ipfs/a', 'https://gw/ipfs/b'],
      route: ROUTE,
      territory: '72.86,19.06;72.87,19.06;72.87,19.07;72.86,19.06',
    });
  });

  it('asks the network once per CID, however many cards want it', async () => {
    const fetchJson = vi.fn(async () => ({ polyline: ROUTE }));
    const load = createActivitySummaryLoader({ fetchJson });
    await Promise.all([load.summary('cid-a'), load.summary('cid-a'), load.summary('cid-a')]);
    await load.summary('cid-a');
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('thins a long route to the point cap', async () => {
    const long = Array.from(
      { length: 500 },
      (_, i) => `${72 + i * 0.001},${19 + Math.sin(i / 20) * 0.01}`
    ).join(';');
    const load = createActivitySummaryLoader({
      fetchJson: async () => ({ polyline: long }),
      maxPoints: 40,
    });
    expect((await load.summary('cid-a'))?.route?.split(';').length).toBeLessThanOrEqual(40);
  });

  it('keeps only what is safe to pass on: strings, at most four photos, no stray fields', async () => {
    const load = createActivitySummaryLoader({
      fetchJson: async () => ({
        name: 42,
        description: 'ok',
        photos: ['a', 'b', 'c', 'd', 'e', 7, { x: 1 }],
        polyline: { evil: true },
        secret: 'nope',
      }),
    });
    expect(await load.summary('cid-a')).toEqual({
      description: 'ok',
      photos: ['a', 'b', 'c', 'd'],
    });
  });

  it('passes on the feed mute and the hidden stats it knows, and nothing else', async () => {
    const load = createActivitySummaryLoader({
      fetchJson: async () => ({
        name: 'Run',
        mutedFromFeeds: true,
        hiddenStats: ['pace', 'pace', 'start_time', 'heart_rate', 9],
      }),
    });
    expect(await load.summary('cid-a')).toEqual({
      name: 'Run',
      mutedFromFeeds: true,
      hiddenStats: ['pace', 'start_time'],
    });
  });

  it('ignores a mute that is not exactly true', async () => {
    const load = createActivitySummaryLoader({
      fetchJson: async () => ({ name: 'Run', mutedFromFeeds: 'yes', hiddenStats: 'pace' }),
    });
    expect(await load.summary('cid-a')).toEqual({ name: 'Run' });
  });

  it('gives null when the metadata holds nothing a card can use, and remembers that too', async () => {
    const fetchJson = vi.fn(async () => ({ coordinates: [[1, 2]] }));
    const load = createActivitySummaryLoader({ fetchJson });
    expect(await load.summary('cid-a')).toBeNull();
    expect(await load.summary('cid-a')).toBeNull();
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('gives null when the fetch fails, tells onError, and tries again on the next ask', async () => {
    const onError = vi.fn();
    const fetchJson = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('gateway down'))
      .mockResolvedValue({ polyline: ROUTE });
    const load = createActivitySummaryLoader({ fetchJson, onError });
    expect(await load.summary('cid-a')).toBeNull();
    expect(onError).toHaveBeenCalledWith('cid-a', expect.any(Error));
    expect(await load.summary('cid-a')).toEqual({ route: ROUTE });
  });

  it('never has more than `concurrency` fetches in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchJson = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { polyline: ROUTE };
    };
    const load = createActivitySummaryLoader({ fetchJson, concurrency: 3 });
    const summaries = await load.summaries(Array.from({ length: 12 }, (_, i) => `cid-${i}`));
    expect(peak).toBeLessThanOrEqual(3);
    expect(summaries.size).toBe(12);
  });
});
