import { bytes, defineSchema, str } from '@arkiv-network/sdk/schema';
import { stringToHex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { createEntityStore, DATA_COLUMN, SOCIAL_LIFETIME_DAYS } from '../arkivEntityStore.js';

const CREATOR = '0x00000000000000000000000000000000000000aa';
const Thing = defineSchema('thing', { name: str().indexed(), data: bytes() });

const row = (n: number, body?: unknown) => ({
  $key: `0x${n.toString(16).padStart(4, '0')}`,
  name: { type: 'str', value: `n${n}` },
  ...(body === undefined
    ? {}
    : { [DATA_COLUMN]: { type: 'bytes', value: stringToHex(JSON.stringify(body)) } }),
});

/** The slice of the SDK's query builder the core uses, over an in-memory list of rows. */
function fakeNode(rows: ReturnType<typeof row>[], skippedPerPage = 0) {
  const calls: {
    selection: Record<string, unknown>;
    creator?: string;
    offsets: number[];
    limits: number[];
  }[] = [];
  const publicClient = {
    select: (selection: Record<string, unknown>) => {
      const call = {
        selection,
        creator: undefined as string | undefined,
        offsets: [] as number[],
        limits: [] as number[],
      };
      calls.push(call);
      let limit = 100;
      let offset = 0;
      const query = {
        from: () => query,
        createdBy: (a: string) => {
          call.creator = a;
          return query;
        },
        where: () => query,
        orderBy: () => query,
        limit: (n: number) => {
          limit = n;
          call.limits.push(n);
          return query;
        },
        offset: (n: number) => {
          offset = n;
          call.offsets.push(n);
          return query;
        },
        fetch: async () => {
          const slice = rows.slice(offset, offset + limit);
          return {
            entities: slice.slice(0, slice.length - skippedPerPage),
            skipped: Math.min(skippedPerPage, slice.length),
          };
        },
      };
      return query;
    },
    count: () => {
      const query = {
        from: () => query,
        createdBy: () => query,
        where: () => query,
        fetch: async () => BigInt(rows.length),
      };
      return query;
    },
  };
  return { publicClient, calls };
}

function wallet() {
  const createEntity = vi.fn(async () => ({ entityKey: '0xnew' }));
  const deleteEntity = vi.fn(async () => ({}));
  return { account: { address: CREATOR }, createEntity, deleteEntity };
}

describe('createEntityStore reads', () => {
  it('scopes every read to the signer that created the entities', async () => {
    const node = fakeNode([row(1)]);

    await createEntityStore(node.publicClient as never, wallet() as never, Thing).query([]);

    expect(node.calls[0]?.creator).toBe(CREATOR);
  });

  it('pages past the node’s 100-row cap and reports nothing truncated when all fit', async () => {
    const node = fakeNode(Array.from({ length: 150 }, (_, i) => row(i)));

    const result = await createEntityStore(
      node.publicClient as never,
      wallet() as never,
      Thing
    ).query([], 200);

    expect(result.entities).toHaveLength(150);
    expect(result.truncated).toBe(false);
    expect(node.calls.flatMap((c) => c.limits)).toEqual([100, 100]);
    expect(node.calls.flatMap((c) => c.offsets)).toEqual([0, 100]);
  });

  it('says truncated when more rows exist than the limit, and returns exactly the limit', async () => {
    const node = fakeNode(Array.from({ length: 30 }, (_, i) => row(i)));

    const result = await createEntityStore(
      node.publicClient as never,
      wallet() as never,
      Thing
    ).query([], 10);

    expect(result.entities).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it('counts rows that did not fit the schema toward the offset, so no page repeats or skips', async () => {
    const node = fakeNode(
      Array.from({ length: 250 }, (_, i) => row(i)),
      5
    );

    await createEntityStore(node.publicClient as never, wallet() as never, Thing).query([], 120);

    expect(node.calls.flatMap((c) => c.offsets)).toEqual([0, 100]);
  });

  it('does not fetch the body unless asked, and decodes it when asked', async () => {
    const node = fakeNode([row(1, { text: 'hi' })]);
    const store = createEntityStore(node.publicClient as never, wallet() as never, Thing);

    await store.query([]);
    const withBody = await store.queryWithPayload([]);

    expect(node.calls[0]?.selection).not.toHaveProperty(DATA_COLUMN);
    expect(node.calls[1]?.selection).toHaveProperty(DATA_COLUMN);
    expect(withBody.entities[0]?.toJson()).toEqual({ text: 'hi' });
    expect(withBody.entities[0]?.attributes.name).toEqual({ type: 'str', value: 'n1' });
    expect(withBody.entities[0]?.attributes).not.toHaveProperty(DATA_COLUMN);
  });

  it('refuses to decode a body that was never fetched', async () => {
    const node = fakeNode([row(1)]);

    const { entities } = await createEntityStore(
      node.publicClient as never,
      wallet() as never,
      Thing
    ).query([]);

    expect(() => entities[0]?.toJson()).toThrow(/without its body/);
  });

  it('caps a count at the limit', async () => {
    const node = fakeNode(Array.from({ length: 50 }, (_, i) => row(i)));

    expect(
      await createEntityStore(node.publicClient as never, wallet() as never, Thing).count([], 20)
    ).toBe(20);
  });
});

describe('createEntityStore writes', () => {
  it('writes a readonly entity with a JSON body that lives under Rabdi’s lifetime cap', async () => {
    const signer = wallet();

    const key = await createEntityStore(
      fakeNode([]).publicClient as never,
      signer as never,
      Thing
    ).create({ note: 'x' }, { name: 'a' });

    expect(key).toBe('0xnew');
    const [schema, values, options] = signer.createEntity.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
      { flags: unknown; expiration: unknown },
    ];
    expect(schema).toBe(Thing);
    expect(options.flags).toEqual({ readonly: true, permissionlessExtension: false });
    expect(new TextDecoder().decode(values[DATA_COLUMN] as Uint8Array)).toBe('{"v":1,"note":"x"}');
    expect(SOCIAL_LIFETIME_DAYS).toBeLessThanOrEqual(182);
  });

  it('deletes by key', async () => {
    const signer = wallet();

    await createEntityStore(fakeNode([]).publicClient as never, signer as never, Thing).remove(
      '0xabc'
    );

    expect(signer.deleteEntity).toHaveBeenCalledWith({ entityKey: '0xabc' });
  });
});

describe('createEntityStore removeAll', () => {
  const liveWallet = (rows: ReturnType<typeof row>[]) => {
    const signer = wallet();
    signer.deleteEntity.mockImplementation((async (args: { entityKey: string }) => {
      const at = rows.findIndex((r) => r.$key === args.entityKey);
      if (at >= 0) rows.splice(at, 1);
      return {};
    }) as never);
    return signer;
  };

  it('deletes every match and says how many', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => row(i));
    const signer = liveWallet(rows);
    const store = createEntityStore(fakeNode(rows).publicClient as never, signer as never, Thing);

    expect(await store.removeAll([])).toBe(3);
    expect(signer.deleteEntity).toHaveBeenCalledTimes(3);
  });

  it('keeps going until nothing is left when one read does not hold them all', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(i));
    const signer = liveWallet(rows);
    const store = createEntityStore(fakeNode(rows).publicClient as never, signer as never, Thing);

    expect(await store.removeAll([], 2)).toBe(5);
    expect(rows).toHaveLength(0);
  });

  it('only reads what this signer created, and deletes nothing when nothing matches', async () => {
    const node = fakeNode([]);
    const signer = wallet();

    expect(
      await createEntityStore(node.publicClient as never, signer as never, Thing).removeAll([])
    ).toBe(0);
    expect(node.calls[0]?.creator).toBe(CREATOR);
    expect(signer.deleteEntity).not.toHaveBeenCalled();
  });
});
