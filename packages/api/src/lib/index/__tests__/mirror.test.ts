import { describe, expect, it } from 'vitest';
import type { Checkpoint, MirrorSource, MirrorStore, StoredEvent } from '../mirror.js';
import { BATCH_EVENTS, CONFIRMATIONS, type RawLog, REWIND_BLOCKS, syncMirror } from '../mirror.js';

const WALLET = '0x00000000000000000000000000000000000000aa';
const hashOf = (n: bigint) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

function chain(
  head: bigint,
  logs: RawLog[],
  forked = new Set<bigint>()
): MirrorSource & { windows: Array<[bigint, bigint]> } {
  const windows: Array<[bigint, bigint]> = [];
  return {
    windows,
    head: async () => ({ number: head, hash: hashOf(head) }),
    hashAt: async (n) => {
      if (n > head) return null;
      return forked.has(n) ? (`0x${'ff'.repeat(32)}` as `0x${string}`) : hashOf(n);
    },
    events: async (from, to) => {
      windows.push([from, to]);
      return logs.filter((l) => l.blockNumber >= from && l.blockNumber <= to);
    },
    timestampAt: async (n) => 1_790_000_000 + Number(n),
  };
}

function memoryStore(initial: { events?: StoredEvent[]; checkpoint?: Checkpoint } = {}) {
  const state = {
    events: [...(initial.events ?? [])],
    checkpoint: initial.checkpoint ?? null,
    writes: 0,
  };
  const store: MirrorStore = {
    checkpoint: async () => state.checkpoint,
    write: async ({ events, checkpoint }) => {
      state.writes += 1;
      state.events.push(...events);
      state.checkpoint = checkpoint;
    },
    rewindTo: async (block) => {
      const before = state.events.length;
      state.events = state.events.filter((e) => e.block <= block);
      return before - state.events.length;
    },
    setCheckpoint: async (checkpoint) => {
      state.checkpoint = checkpoint;
    },
  };
  return { store, state };
}

const activity = (block: bigint, logIndex = 0): RawLog => ({
  name: 'ActivityRecorded',
  args: { activityId: block, owner: WALLET, distance: 1000n, timestamp: 1n },
  blockNumber: block,
  logIndex,
});

const options = (deployBlock: bigint) => ({ deployBlock, windowBlocks: 100n });

describe('syncMirror', () => {
  it('writes each event once and moves the checkpoint to the newest block it has answered for', async () => {
    const { store, state } = memoryStore();

    const result = await syncMirror(
      chain(1_000n, [activity(10n), activity(20n)]),
      store,
      options(5n)
    );

    expect(state.events.map((e) => e.block)).toEqual([10n, 20n]);
    expect(state.checkpoint?.block).toBe(1_000n - BigInt(CONFIRMATIONS));
    expect(result.written).toBe(2);
  });

  it('stops short of the chain head by the confirmation lag, so a block that may still reorg is not mirrored', async () => {
    const { store, state } = memoryStore();
    const head = 100n;

    await syncMirror(
      chain(head, [activity(head), activity(head - BigInt(CONFIRMATIONS) + 1n)]),
      store,
      options(1n)
    );

    expect(state.events).toHaveLength(0);
  });

  it('reads the log range in windows the RPC accepts, oldest first, and misses no block', async () => {
    const { store } = memoryStore();
    const source = chain(1_000n, []);

    await syncMirror(source, store, options(1n));

    expect(source.windows[0]?.[0]).toBe(1n);
    for (let i = 1; i < source.windows.length; i++) {
      expect((source.windows[i]?.[0] ?? 0n) - (source.windows[i - 1]?.[1] ?? 0n)).toBe(1n);
    }
    expect(source.windows.at(-1)?.[1]).toBe(1_000n - BigInt(CONFIRMATIONS));
    for (const [from, to] of source.windows) expect(to - from + 1n <= 100n).toBe(true);
  });

  it('does nothing and writes nothing when there is nothing new', async () => {
    const { store, state } = memoryStore();
    const source = chain(1_000n, [activity(10n)]);
    await syncMirror(source, store, options(1n));
    const writes = state.writes;

    const again = await syncMirror(source, store, options(1n));

    expect(again.written).toBe(0);
    expect(state.writes).toBe(writes);
    expect(state.events).toHaveLength(1);
  });

  it('picks up only what happened since the checkpoint on the next run', async () => {
    const { store, state } = memoryStore();
    await syncMirror(chain(1_000n, [activity(10n)]), store, options(1n));

    await syncMirror(chain(2_000n, [activity(10n), activity(1_500n)]), store, options(1n));

    expect(state.events.map((e) => e.block)).toEqual([10n, 1_500n]);
  });

  it('puts events from one block in log order and keeps a block whole in one write', async () => {
    const { store, state } = memoryStore();
    const logs = [activity(10n, 5), activity(10n, 1), activity(10n, 3)];

    await syncMirror(chain(1_000n, logs), store, options(1n));

    expect(state.events.map((e) => e.evt)).toEqual([...state.events.map((e) => e.evt)].sort());
    expect(state.writes).toBe(1);
  });

  it('splits a long run of events into writes of a size one transaction can carry', async () => {
    const { store, state } = memoryStore();
    const logs = Array.from({ length: BATCH_EVENTS * 2 + 3 }, (_, i) => activity(BigInt(10 + i)));

    await syncMirror(chain(10_000n, logs), store, options(1n));

    expect(state.events).toHaveLength(logs.length);
    expect(state.writes).toBe(3);
  });

  it('rewinds and rescans when the block it last answered for is no longer on the chain', async () => {
    const checkpoint = { block: 500n, hash: hashOf(500n) };
    const stale: StoredEvent = { ...toStored(activity(495n)) };
    const { store, state } = memoryStore({ events: [stale, toStored(activity(100n))], checkpoint });
    const forked = new Set<bigint>([500n]);

    const result = await syncMirror(
      chain(1_000n, [activity(100n), activity(495n)], forked),
      store,
      options(1n)
    );

    expect(result.reorged).toBe(true);
    // Everything after the rewind point was dropped and read again; the older event was kept and not duplicated.
    const blocks = state.events.map((e) => e.block).sort((a, b) => Number(a - b));
    expect(blocks).toEqual([100n, 495n]);
    expect(500n - BigInt(REWIND_BLOCKS)).toBeLessThan(495n);
  });

  it('deletes events beyond the checkpoint before reading on: a write whose outcome was never learned must not double up', async () => {
    const checkpoint = { block: 50n, hash: hashOf(50n) };
    const orphan = toStored(activity(60n));
    const { store, state } = memoryStore({ events: [orphan], checkpoint });

    await syncMirror(chain(1_000n, [activity(60n)]), store, options(1n));

    expect(state.events.filter((e) => e.block === 60n)).toHaveLength(1);
  });
});

function toStored(log: RawLog): StoredEvent {
  return {
    kind: log.name,
    evt: `${log.blockNumber.toString().padStart(13, '0')}-${String(log.logIndex).padStart(5, '0')}`,
    block: log.blockNumber,
    ts: 0,
    who: WALLET,
    ref: log.blockNumber.toString(),
    data: {},
  };
}
