import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncedActivity } from '../sync';

const getActivitySummaries = vi.fn();
const fetchJsonFromIpfs = vi.fn();
vi.mock('../activitySummaries', () => ({ getActivitySummaries }));
vi.mock('../ipfs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ipfs')>()),
  fetchJsonFromIpfs,
}));

const { hydrateActivityMetadata } = await import('../sync');

const activity = (id: number, cid?: string): SyncedActivity =>
  ({ activityId: BigInt(id), metadataCid: cid }) as SyncedActivity;

beforeEach(() => {
  getActivitySummaries.mockReset();
  fetchJsonFromIpfs.mockReset();
});

describe('hydrateActivityMetadata', () => {
  it('takes name, text, photos and route from the index without touching IPFS', async () => {
    getActivitySummaries.mockResolvedValue(
      new Map([['cid-a', { name: 'Run', description: 'hi', photos: ['p'], polyline: '1,2;3,4' }]])
    );

    const [hydrated] = await hydrateActivityMetadata([activity(1, 'cid-a')]);

    expect(fetchJsonFromIpfs).not.toHaveBeenCalled();
    expect(hydrated).toMatchObject({
      metadataName: 'Run',
      metadataDescription: 'hi',
      metadataPhotos: ['p'],
      metadataPolyline: '1,2;3,4',
    });
  });

  it('hands on the feed mute and hidden stats', async () => {
    getActivitySummaries.mockResolvedValue(
      new Map([['cid-a', { mutedFromFeeds: true, hiddenStats: ['pace'] }]])
    );
    const [hydrated] = await hydrateActivityMetadata([activity(1, 'cid-a')]);
    expect(hydrated).toMatchObject({ metadataMuted: true, metadataHiddenStats: ['pace'] });
  });

  it('fetches from IPFS only the CIDs the index did not cover', async () => {
    getActivitySummaries.mockResolvedValue(new Map([['cid-a', { polyline: '1,2;3,4' }]]));
    fetchJsonFromIpfs.mockResolvedValue({ name: 'From IPFS' });

    const result = await hydrateActivityMetadata([activity(1, 'cid-a'), activity(2, 'cid-b')]);

    expect(fetchJsonFromIpfs).toHaveBeenCalledTimes(1);
    expect(fetchJsonFromIpfs).toHaveBeenCalledWith('cid-b');
    expect(result[0]?.metadataPolyline).toBe('1,2;3,4');
    expect(result[1]?.metadataName).toBe('From IPFS');
  });

  it('falls back to IPFS for everything when the index is unavailable', async () => {
    getActivitySummaries.mockResolvedValue(null);
    fetchJsonFromIpfs.mockImplementation(async (cid: string) => ({ name: cid }));

    const result = await hydrateActivityMetadata([activity(1, 'cid-a'), activity(2, 'cid-b')]);

    expect(result.map((a) => a.metadataName)).toEqual(['cid-a', 'cid-b']);
  });

  it('asks IPFS once per CID and never runs more than a handful of fetches at once', async () => {
    getActivitySummaries.mockResolvedValue(null);
    let inFlight = 0;
    let peak = 0;
    fetchJsonFromIpfs.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 3));
      inFlight--;
      return { name: 'x' };
    });
    const many = Array.from({ length: 20 }, (_, i) => activity(i + 1, `cid-${i % 12}`));

    await hydrateActivityMetadata(many);

    expect(fetchJsonFromIpfs).toHaveBeenCalledTimes(12);
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('leaves an activity with no metadata CID untouched and skips the index entirely when none have one', async () => {
    const plain = activity(1);
    expect(await hydrateActivityMetadata([plain])).toEqual([plain]);
    expect(getActivitySummaries).not.toHaveBeenCalled();
  });

  it('keeps the activity (just without extras) when one IPFS fetch comes back empty', async () => {
    getActivitySummaries.mockResolvedValue(null);
    fetchJsonFromIpfs.mockResolvedValue(null);
    const [hydrated] = await hydrateActivityMetadata([activity(1, 'cid-a')]);
    expect(hydrated?.metadataName).toBeUndefined();
  });
});
