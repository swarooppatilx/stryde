import { stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { CheckpointSchema, createArkivMirrorStore, EventSchema } from '../arkivMirror.js';
import type { StoredEvent } from '../mirror.js';
import { compare } from '../order.js';

const CREATOR = '0x00000000000000000000000000000000000000cc';
const WALLET = '0x00000000000000000000000000000000000000aa';
const HASH = `0x${'ab'.repeat(32)}` as const;

type Typed = { type: string; value: unknown };
interface Row {
  key: string;
  schema: string;
  attrs: Record<string, Typed>;
}

/** An in-memory stand-in for the two Arkiv clients: it understands the SDK's plain-data filters. */
function fakeArkiv() {
  const rows: Row[] = [];
  const batches: Array<{ creates: number; deletes: number }> = [];
  let next = 1;

  const matches = (row: Row, expr: { name: string; operator: string; value: Typed }) => {
    const have = row.attrs[expr.name]?.value;
    const want = expr.value.value;
    const [a, b] = typeof want === 'bigint' ? [BigInt(have as bigint), want] : [have, want];
    switch (expr.operator) {
      case '=':
        return String(a).toLowerCase() === String(b).toLowerCase();
      case '>':
        return (a as never) > (b as never);
      case '>=':
        return (a as never) >= (b as never);
      default:
        throw new Error(`fake does not know ${expr.operator}`);
    }
  };

  const select = () => {
    let schemaName = '';
    let filters: Array<{ name: string; operator: string; value: Typed }> = [];
    let order = { name: '$key', direction: 'asc' };
    let limit = 100;
    let offset = 0;
    const query = {
      from: (schema: { name: string }) => {
        schemaName = schema.name;
        return query;
      },
      createdBy: () => query,
      where: (...exprs: typeof filters) => {
        filters = exprs;
        return query;
      },
      orderBy: (o: typeof order) => {
        order = o;
        return query;
      },
      limit: (n: number) => {
        limit = n;
        return query;
      },
      offset: (n: number) => {
        offset = n;
        return query;
      },
      fetch: async () => {
        const hits = rows
          .filter((r) => r.schema === schemaName && filters.every((f) => matches(r, f)))
          .sort((a, b) => {
            const av = order.name === '$key' ? a.key : String(a.attrs[order.name]?.value);
            const bv = order.name === '$key' ? b.key : String(b.attrs[order.name]?.value);
            return compare(av, bv);
          });
        return {
          entities: hits.slice(offset, offset + limit).map((r) => ({ $key: r.key, ...r.attrs })),
          skipped: 0,
        };
      },
    };
    return query;
  };

  const publicClient = { select };
  const walletClient = {
    account: { address: CREATOR },
    executeBatch: async (batch: {
      creates?: Array<{ schema: { name: string }; values: Record<string, unknown> }>;
      deletes?: Array<{ entityKey: string }>;
    }) => {
      batches.push({ creates: batch.creates?.length ?? 0, deletes: batch.deletes?.length ?? 0 });
      for (const del of batch.deletes ?? []) {
        const i = rows.findIndex((r) => r.key === del.entityKey);
        if (i >= 0) rows.splice(i, 1);
      }
      for (const create of batch.creates ?? []) {
        const attrs: Record<string, Typed> = {};
        for (const [name, value] of Object.entries(create.values)) {
          attrs[name] =
            value instanceof Uint8Array
              ? { type: 'bytes', value: stringToHex(new TextDecoder().decode(value)) }
              : (value as Typed);
        }
        rows.push({
          key: `0x${(next++).toString(16).padStart(4, '0')}`,
          schema: create.schema.name,
          attrs,
        });
      }
      return { txHash: '0xtx', createdEntities: [], deletedEntities: [] };
    },
  };
  return { publicClient, walletClient, rows, batches };
}

const event = (
  block: bigint,
  logIndex: number,
  kind = 'ActivityRecorded',
  who = WALLET,
  ref = '1'
): StoredEvent => ({
  kind,
  evt: `${block.toString().padStart(13, '0')}-${String(logIndex).padStart(5, '0')}`,
  block,
  ts: 1_790_000_000,
  who: who as never,
  ref,
  data: { distance: '1200' },
});

const open = (fake = fakeArkiv()) => ({
  fake,
  store: createArkivMirrorStore(fake.publicClient as never, fake.walletClient as never),
});

describe('createArkivMirrorStore', () => {
  it('has a schema name for events and one for the checkpoint, so they never mix', () => {
    expect(EventSchema.name).toBe('idx_event');
    expect(CheckpointSchema.name).toBe('idx_checkpoint');
  });

  it('writes a batch of events and the checkpoint in one transaction', async () => {
    const { fake, store } = open();

    await store.write({
      events: [event(10n, 0), event(10n, 1), event(11n, 0)],
      checkpoint: { block: 11n, hash: HASH },
    });

    expect(fake.batches).toEqual([{ creates: 4, deletes: 0 }]);
    expect(await store.checkpoint()).toEqual({ block: 11n, hash: HASH });
  });

  it('replaces the old checkpoint in the same transaction rather than leaving two', async () => {
    const { fake, store } = open();
    await store.write({ events: [event(10n, 0)], checkpoint: { block: 10n, hash: HASH } });

    await store.write({ events: [event(20n, 0)], checkpoint: { block: 20n, hash: HASH } });

    expect(fake.batches[1]).toEqual({ creates: 2, deletes: 1 });
    expect(fake.rows.filter((r) => r.schema === 'idx_checkpoint')).toHaveLength(1);
    expect((await store.checkpoint())?.block).toBe(20n);
  });

  it('answers null before anything was written', async () => {
    expect(await open().store.checkpoint()).toBeNull();
  });

  it('moves only the checkpoint when there are no events', async () => {
    const { fake, store } = open();

    await store.setCheckpoint({ block: 500n, hash: HASH });

    expect(fake.batches).toEqual([{ creates: 1, deletes: 0 }]);
    expect((await store.checkpoint())?.block).toBe(500n);
  });

  it('deletes only the events after a block, and says how many', async () => {
    const { fake, store } = open();
    await store.write({
      events: [event(10n, 0), event(20n, 0), event(30n, 0)],
      checkpoint: { block: 30n, hash: HASH },
    });

    const deleted = await store.rewindTo(10n);

    expect(deleted).toBe(2);
    const left = fake.rows.filter((r) => r.schema === 'idx_event').map((r) => r.attrs.block?.value);
    expect(left).toEqual([10n]);
  });

  it('removes a long tail in several transactions instead of one oversized one', async () => {
    const { fake, store } = open();
    const many = Array.from({ length: 120 }, (_, i) => event(BigInt(100 + i), 0));
    for (let i = 0; i < many.length; i += 20) {
      await store.write({ events: many.slice(i, i + 20), checkpoint: { block: 300n, hash: HASH } });
    }
    fake.batches.length = 0;

    expect(await store.rewindTo(99n)).toBe(120);

    expect(fake.batches.length).toBeGreaterThan(1);
    for (const batch of fake.batches) expect(batch.deletes).toBeLessThanOrEqual(50);
  });

  it('reads events of one kind in chain order, filtered by wallet and reference', async () => {
    const { store } = open();
    const other = '0x00000000000000000000000000000000000000bb';
    await store.write({
      events: [
        event(30n, 0, 'ActivityRecorded', WALLET, '3'),
        event(10n, 0, 'ActivityRecorded', WALLET, '1'),
        event(20n, 0, 'ActivityRecorded', other, '2'),
        event(15n, 0, 'GroupJoined', WALLET, '1'),
      ],
      checkpoint: { block: 30n, hash: HASH },
    });

    const mine = await store.events({ kind: 'ActivityRecorded', who: WALLET });
    const one = await store.events({ kind: 'ActivityRecorded', ref: '2' });

    expect(mine.map((e) => e.ref)).toEqual(['1', '3']);
    expect(one.map((e) => e.who)).toEqual([other]);
    expect(mine[0]).toMatchObject({
      kind: 'ActivityRecorded',
      block: 10n,
      ts: 1_790_000_000,
      data: { distance: '1200' },
    });
  });
});
