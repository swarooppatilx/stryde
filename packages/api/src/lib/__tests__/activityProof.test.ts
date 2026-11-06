import { describe, expect, it, vi } from 'vitest';
import {
  findRecordedActivity,
  findRecordedActivityInSubgraph,
  LOG_WINDOW_BLOCKS,
} from '../activityProof.js';

const REGISTRY = '0x0000000000000000000000000000000000000006';
const HASH = `0x${'ab'.repeat(32)}` as const;
const OWNER = '0x00000000000000000000000000000000000000aa' as const;

const log = (owner: `0x${string}`, distance: bigint) => ({ args: { owner, distance } });

function client(latest: bigint, logsAt: (from: bigint, to: bigint) => ReturnType<typeof log>[]) {
  return {
    getBlockNumber: vi.fn(async () => latest),
    getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      logsAt(fromBlock, toBlock)
    ),
  };
}

describe('findRecordedActivity', () => {
  // viem caches getBlockNumber for about four seconds. A reward is requested right after the athlete
  // records, so a cached head sits before the new block and the scan misses the very activity it is for.
  it('reads the chain head fresh, never from the client’s few-second cache', async () => {
    const c = client(1_000n, () => [log(OWNER, 5_000n)]);

    await findRecordedActivity(c, REGISTRY, HASH, 100n);

    expect(c.getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 });
  });

  it('returns who recorded the activity and how far they went', async () => {
    const c = client(1_000n, () => [log(OWNER, 5_000n)]);

    expect(await findRecordedActivity(c, REGISTRY, HASH, 100n)).toEqual({
      owner: OWNER,
      distance: 5_000n,
    });
    expect(c.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ address: REGISTRY, args: { activityHash: HASH } })
    );
  });

  it('searches newest blocks first in windows the RPC accepts, down to the deploy block', async () => {
    const deploy = 10n;
    const latest = deploy + LOG_WINDOW_BLOCKS * 2n + 5n;
    const recordedAt = deploy + 3n;
    const c = client(latest, (from, to) =>
      from <= recordedAt && recordedAt <= to ? [log(OWNER, 1n)] : []
    );

    expect(await findRecordedActivity(c, REGISTRY, HASH, deploy)).not.toBeNull();

    const ranges = c.getLogs.mock.calls.map(([p]) => [p.fromBlock, p.toBlock]);
    expect(ranges[0]?.[1]).toBe(latest);
    for (const [from, to] of ranges)
      expect((to as bigint) - (from as bigint) + 1n).toBeLessThanOrEqual(LOG_WINDOW_BLOCKS);
    expect(ranges[ranges.length - 1]?.[0]).toBe(deploy);
  });

  it('waits out an RPC node that lags the head instead of failing', async () => {
    const c = client(1_000n, () => [log(OWNER, 5_000n)]);
    const pastHead = Object.assign(new Error('Invalid parameters'), {
      details: 'block range extends beyond current head block: requested 1000, head 999',
    });
    c.getLogs.mockRejectedValueOnce(pastHead);

    expect(await findRecordedActivity(c, REGISTRY, HASH, 100n, { headLagDelayMs: 0 })).toEqual({
      owner: OWNER,
      distance: 5_000n,
    });
    expect(c.getLogs).toHaveBeenCalledTimes(2);
    expect(c.getLogs.mock.calls[1]?.[0]).toMatchObject({ toBlock: 1_000n });
  });

  it('still fails on other RPC errors', async () => {
    const c = client(1_000n, () => []);
    c.getLogs.mockRejectedValueOnce(new Error('rate limited'));

    await expect(
      findRecordedActivity(c, REGISTRY, HASH, 100n, { headLagDelayMs: 0 })
    ).rejects.toThrow('rate limited');
  });

  it('returns null when the hash was never recorded', async () => {
    const c = client(LOG_WINDOW_BLOCKS * 3n, () => []);

    expect(await findRecordedActivity(c, REGISTRY, HASH, 0n)).toBeNull();
    expect(c.getLogs).toHaveBeenCalledTimes(4);
  });
});

describe('findRecordedActivityInSubgraph', () => {
  const URL = 'https://subgraph.test/q';

  it('reads the owner and distance by activity hash', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ data: { activities: [{ user: { id: OWNER }, distance: '5000' }] } })
    );

    const found = await findRecordedActivityInSubgraph(URL, HASH, fetchFn);

    expect(found).toEqual({ owner: OWNER, distance: 5000n });
    const body = JSON.parse(
      (fetchFn.mock.calls[0] as unknown as [string, { body: string }])[1].body
    );
    expect(body.variables).toEqual({ hash: HASH });
  });

  it('returns null when the subgraph has not indexed it', async () => {
    const fetchFn = vi.fn(async () => Response.json({ data: { activities: [] } }));

    expect(await findRecordedActivityInSubgraph(URL, HASH, fetchFn)).toBeNull();
  });

  it('rejects on a subgraph error so the caller can fall back', async () => {
    const fetchFn = vi.fn(async () => Response.json({ errors: [{ message: 'indexer down' }] }));

    await expect(findRecordedActivityInSubgraph(URL, HASH, fetchFn)).rejects.toThrow(
      'indexer down'
    );
  });
});
