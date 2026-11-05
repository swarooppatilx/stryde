import { describe, expect, it, vi } from 'vitest';
import { createChainIndex, LOG_WINDOW_BLOCKS, REORG_DEPTH } from '../chainIndex.js';

const ME = '0x00000000000000000000000000000000000000aa';
const THEM = '0x00000000000000000000000000000000000000bb';
const ZERO = '0x0000000000000000000000000000000000000000';
const REGISTRY = '0x0000000000000000000000000000000000000c01';
const CHALLENGES = '0x0000000000000000000000000000000000000c02';
const TERRITORIES = '0x0000000000000000000000000000000000000c03';
const contracts = {
  activityRegistry: REGISTRY,
  challengeRegistry: CHALLENGES,
  territoryRegistry: TERRITORIES,
} as never;

const recorded = (blockNumber: bigint, distance: bigint, timestamp: bigint, type = 0) => ({
  blockNumber,
  args: {
    activityId: 1n,
    owner: ME,
    activityHash: `0x${'ab'.repeat(32)}`,
    activityType: type,
    distance,
    duration: 600n,
    timestamp,
    territoryArea: 0n,
  },
});

function fakeClient(over: Record<string, unknown> = {}) {
  return {
    getBlockNumber: vi.fn(async () => 120_000n),
    getBlock: vi.fn(async (args: { blockNumber?: bigint }) => ({
      timestamp: args.blockNumber === undefined ? 5_000n : 1_000n,
    })),
    // The parameter is declared so `mock.calls[n][0]` is typed; the fake itself ignores it.
    getLogs: vi.fn(async (_params?: unknown) => [] as unknown[]),
    readContract: vi.fn(async () => null),
    ...over,
  };
}

describe('headTimestamp', () => {
  it('is the latest block’s timestamp', async () => {
    const index = createChainIndex(fakeClient() as never, contracts, 0n);

    expect(await index.headTimestamp()).toBe(5_000);
  });
});

describe('activities', () => {
  it('reads the chain head fresh, so a run recorded a moment ago is not missed', async () => {
    const client = fakeClient();

    await createChainIndex(client as never, contracts, 0n).activities(ME);

    expect(client.getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 });
  });

  it('reads one athlete’s ActivityRecorded logs and maps them to plain numbers', async () => {
    const client = fakeClient({ getLogs: vi.fn(async () => [recorded(10n, 5_000n, 2_000n, 1)]) });

    const found = await createChainIndex(client as never, contracts, 119_000n).activities(ME);

    expect(found).toEqual([
      {
        user: ME,
        activityHash: `0x${'ab'.repeat(32)}`,
        activityType: 1,
        distance: 5000,
        duration: 600,
        timestamp: 2000,
      },
    ]);
    const call = client.getLogs.mock.calls[0]?.[0] as { address: string; args: { owner: string } };
    expect(call.address).toBe(REGISTRY);
    expect(call.args.owner).toBe(ME);
  });

  it('keeps only activities inside the window, edges included', async () => {
    const client = fakeClient({
      getLogs: vi.fn(async () => [
        recorded(1n, 100n, 999n),
        recorded(2n, 200n, 1_000n),
        recorded(3n, 300n, 2_000n),
        recorded(4n, 400n, 2_001n),
      ]),
    });

    const found = await createChainIndex(client as never, contracts, 119_000n).activities(ME, {
      from: 1_000,
      to: 2_000,
    });

    expect(found.map((a) => a.distance)).toEqual([200, 300]);
  });

  it('splits a long history into windows the public RPC accepts and misses nothing', async () => {
    const head = LOG_WINDOW_BLOCKS * 2n + 10n;
    const client = fakeClient({
      getBlockNumber: vi.fn(async () => head),
      getLogs: vi.fn(async () => []),
    });

    await createChainIndex(client as never, contracts, 0n).activities(ME);

    const ranges = client.getLogs.mock.calls.map((c) => {
      const p = c[0] as { fromBlock: bigint; toBlock: bigint };
      return [p.fromBlock, p.toBlock] as const;
    });
    expect(ranges).toHaveLength(3);
    expect(ranges[0]?.[0]).toBe(0n);
    expect(ranges.at(-1)?.[1]).toBe(head);
    for (let i = 1; i < ranges.length; i++) {
      expect((ranges[i]?.[0] ?? 0n) - (ranges[i - 1]?.[1] ?? 0n)).toBe(1n);
    }
    for (const [from, to] of ranges) expect(to - from + 1n <= LOG_WINDOW_BLOCKS).toBe(true);
  });

  it('scans only the blocks since the settled part of the last scan', async () => {
    const head = vi.fn(async () => 120_000n);
    const onChain = [recorded(1_000n, 100n, 1_000n), recorded(119_990n, 200n, 2_000n)];
    const client = fakeClient({
      getBlockNumber: head,
      getLogs: vi.fn(async (p?: unknown) => {
        const { fromBlock, toBlock } = p as { fromBlock: bigint; toBlock: bigint };
        return onChain.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock);
      }),
    });
    const index = createChainIndex(client as never, contracts, 0n);

    await index.activities(ME);
    client.getLogs.mockClear();
    head.mockResolvedValue(120_010n);
    const found = await index.activities(ME);

    expect(client.getLogs).toHaveBeenCalledOnce();
    const call = client.getLogs.mock.calls[0]?.[0] as { fromBlock: bigint; toBlock: bigint };
    expect(call.fromBlock).toBe(120_000n - REORG_DEPTH + 1n);
    expect(call.toBlock).toBe(120_010n);
    // The settled log comes from memory, the recent one from the rescan: each exactly once.
    expect(found.map((a) => a.distance)).toEqual([100, 200]);
  });

  it('starts at the deploy block, not at genesis', async () => {
    const client = fakeClient();

    await createChainIndex(client as never, contracts, 119_500n).activities(ME);

    const first = client.getLogs.mock.calls[0]?.[0] as { fromBlock: bigint } | undefined;
    expect(first?.fromBlock).toBe(119_500n);
  });
});

describe('challenge', () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    challenger: ME,
    opponent: THEM,
    stake: 10n,
    activityType: 0,
    targetMetric: 5000n,
    deadline: 9_999n,
    winner: ZERO,
    status: 1,
    ...over,
  });

  it('returns null for an id the registry never issued (a zeroed struct, not a revert)', async () => {
    const client = fakeClient({ readContract: vi.fn(async () => raw({ challenger: ZERO })) });

    expect(await createChainIndex(client as never, contracts, 0n).challenge(7n)).toBeNull();
  });

  it('maps the status number to its name and takes createdAt from the creating block', async () => {
    const client = fakeClient({
      readContract: vi.fn(async () => raw({ status: 1 })),
      getLogs: vi.fn(async () => [{ blockNumber: 77n, args: {} }]),
    });

    const challenge = await createChainIndex(client as never, contracts, 0n).challenge(7n);

    expect(challenge).toEqual({
      status: 'Accepted',
      activityType: 0,
      deadline: 9_999,
      createdAt: 1_000,
      challenger: ME,
      opponent: THEM,
    });
    expect(client.getBlock).toHaveBeenCalledWith({ blockNumber: 77n });
  });

  it('names every status the contract has', async () => {
    const names: string[] = [];
    for (const status of [0, 1, 2, 3]) {
      const client = fakeClient({
        readContract: vi.fn(async () => raw({ status })),
        getLogs: vi.fn(async () => [{ blockNumber: 1n, args: {} }]),
      });
      names.push(
        (await createChainIndex(client as never, contracts, 0n).challenge(1n))?.status ?? ''
      );
    }
    expect(names).toEqual(['Open', 'Accepted', 'Settled', 'Cancelled']);
  });

  it('fails loudly when the creating log cannot be found, rather than judging from a made-up start', async () => {
    const client = fakeClient({
      readContract: vi.fn(async () => raw()),
      getLogs: vi.fn(async () => []),
    });

    await expect(createChainIndex(client as never, contracts, 0n).challenge(7n)).rejects.toThrow(
      /creation/i
    );
  });
});

describe('activeTerritoryArea', () => {
  it('adds up the area of every territory the athlete holds', async () => {
    const readContract = vi.fn(async (args: { functionName: string; args: unknown[] }) => {
      if (args.functionName === 'getUserTerritories') return ['0x01', '0x02'];
      return { areaSqm: args.args[0] === '0x01' ? 1_500n : 2_500n };
    });

    const area = await createChainIndex(
      fakeClient({ readContract }) as never,
      contracts,
      0n
    ).activeTerritoryArea(ME);

    expect(area).toBe(4_000);
  });

  it('is zero for an athlete with no territory', async () => {
    const readContract = vi.fn(async () => []);

    expect(
      await createChainIndex(
        fakeClient({ readContract }) as never,
        contracts,
        0n
      ).activeTerritoryArea(ME)
    ).toBe(0);
  });
});
