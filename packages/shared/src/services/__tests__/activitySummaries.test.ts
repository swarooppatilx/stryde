import { afterEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';

const { getActivitySummaries } = await import('../activitySummaries');

function api(answer: { status?: number; body: unknown } | 'down') {
  const calls: string[] = [];
  setIpfsConfig({
    apiUrl: 'http://api.test',
    apiKey: 'k',
    fetch: (async (url: string) => {
      const parsed = new URL(url);
      calls.push(parsed.pathname + parsed.search);
      if (answer === 'down') throw new Error('network down');
      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
    }) as typeof fetch,
  });
  return calls;
}

afterEach(() => {
  setIpfsConfig(undefined as never);
  vi.restoreAllMocks();
});

describe('getActivitySummaries', () => {
  it('maps each CID to the metadata the index already read for it', async () => {
    const calls = api({
      body: {
        activities: [
          {
            metadataCid: 'cid-a',
            summary: {
              name: 'Evening Run',
              description: 'felt good',
              photos: ['https://gw/ipfs/a'],
              route: '72.86,19.06;72.87,19.07',
              territory: '72.86,19.06;72.87,19.06;72.87,19.07;72.86,19.06',
            },
          },
          { metadataCid: 'cid-b' },
          { metadataCid: null },
        ],
      },
    });

    const result = await getActivitySummaries();

    expect(calls[0]).toContain('/api/index/activities');
    expect(calls[0]).toContain('withRoute=1');
    expect([...(result?.keys() ?? [])]).toEqual(['cid-a']);
    expect(result?.get('cid-a')).toEqual({
      name: 'Evening Run',
      description: 'felt good',
      photos: ['https://gw/ipfs/a'],
      polyline: '72.86,19.06;72.87,19.07',
      territory: [
        [72.86, 19.06],
        [72.87, 19.06],
        [72.87, 19.07],
        [72.86, 19.06],
      ],
    });
  });

  it('carries the feed mute and hidden stats through', async () => {
    api({
      body: {
        activities: [
          {
            metadataCid: 'cid-a',
            summary: { name: 'Run', mutedFromFeeds: true, hiddenStats: ['pace'] },
          },
        ],
      },
    });
    expect((await getActivitySummaries())?.get('cid-a')).toEqual({
      name: 'Run',
      mutedFromFeeds: true,
      hiddenStats: ['pace'],
    });
  });

  it('is null when the index cannot answer, so the caller falls back to IPFS', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    api('down');
    expect(await getActivitySummaries()).toBeNull();
  });

  it('is null when the answer is not the shape it expects', async () => {
    api({ body: { activities: 'nope' } });
    expect(await getActivitySummaries()).toBeNull();
  });
});
