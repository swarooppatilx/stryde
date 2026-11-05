import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArkivLedger } from '../contributionLedger.js';

const ME = '0x00000000000000000000000000000000000000aa';
const OTHER = '0x00000000000000000000000000000000000000bb';
const PARTICIPANT = '0x00000000000000000000000000000000000000cc';
const HASH = `0x${'ab'.repeat(32)}` as const;

interface StoredEntity {
  key: string;
  creator: string;
  attributes: Record<string, string>;
}

type Predicate = { name: string; value: { value: string } };
type Typed = { value: string };

/** Just enough of the Arkiv client for the calls the ledger makes: attribute equality + creator. */
function fakeArkiv() {
  const entities: StoredEntity[] = [];
  let nextKey = 0;

  const publicClient = {
    select: () => {
      let predicates: Predicate[] = [];
      let creator: string | undefined;
      const query = {
        from: () => query,
        where: (...found: Predicate[]) => {
          predicates = found;
          return query;
        },
        createdBy: (address: string) => {
          creator = address;
          return query;
        },
        limit: () => query,
        fetch: async () => ({
          entities: entities
            .filter((e) => creator === undefined || e.creator === creator)
            .filter((e) => predicates.every((p) => e.attributes[p.name] === p.value.value))
            .map(({ key }) => ({ $key: key })),
        }),
      };
      return query;
    },
  };

  const walletClient = (account: string) => ({
    account: { address: account },
    createEntity: vi.fn(async (_schema: unknown, values: Record<string, Typed | unknown>) => {
      const key = `0xkey${++nextKey}`;
      // The body bytes are not a filterable column, so the fake keeps only the typed columns.
      const attributes = Object.fromEntries(
        Object.entries(values)
          .filter(([name]) => name !== 'data')
          .map(([name, v]) => [name, (v as Typed).value])
      );
      entities.push({ key, creator: account, attributes });
      return { entityKey: key };
    }),
    deleteEntity: vi.fn(async ({ entityKey }: { entityKey: string }) => {
      const at = entities.findIndex((e) => e.key === entityKey);
      if (at >= 0) entities.splice(at, 1);
    }),
  });

  return { entities, publicClient, walletClient };
}

describe('createArkivLedger', () => {
  let arkiv: ReturnType<typeof fakeArkiv>;
  let wallet: ReturnType<ReturnType<typeof fakeArkiv>['walletClient']>;
  let ledger: ReturnType<typeof createArkivLedger>;

  beforeEach(() => {
    arkiv = fakeArkiv();
    wallet = arkiv.walletClient(ME);
    ledger = createArkivLedger(arkiv.publicClient as never, wallet as never);
  });

  it('has nothing for an unknown activity', async () => {
    expect(await ledger.has(HASH)).toBe(false);
  });

  it('holds a reserved activity and returns the key of the claim it created', async () => {
    const claim = await ledger.reserve(HASH, PARTICIPANT);

    expect(await ledger.has(HASH)).toBe(true);
    expect(arkiv.entities).toEqual([
      expect.objectContaining({
        key: claim,
        attributes: expect.objectContaining({ state: 'pending' }),
      }),
    ]);
  });

  it('releases exactly the given claim and leaves other claims alone', async () => {
    const other = `0x${'cd'.repeat(32)}` as const;
    const claim = await ledger.reserve(HASH, PARTICIPANT);
    await ledger.reserve(other, PARTICIPANT);

    await ledger.release(claim);

    expect(await ledger.has(HASH)).toBe(false);
    expect(await ledger.has(other)).toBe(true);
    expect(wallet.deleteEntity).toHaveBeenCalledOnce();
    expect(wallet.deleteEntity).toHaveBeenCalledWith({ entityKey: claim });
  });

  it('counts the activity on mark and clears its claim', async () => {
    const claim = await ledger.reserve(HASH, PARTICIPANT);

    await ledger.mark(HASH, PARTICIPANT, claim);

    expect(await ledger.has(HASH)).toBe(true);
    expect(arkiv.entities).toHaveLength(1);
    expect(arkiv.entities[0]?.attributes.state).toBe('counted');
  });

  it('still counts the activity when clearing the claim fails', async () => {
    const claim = await ledger.reserve(HASH, PARTICIPANT);
    wallet.deleteEntity.mockRejectedValueOnce(new Error('rpc down'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(ledger.mark(HASH, PARTICIPANT, claim)).resolves.toBeUndefined();

    expect(await ledger.has(HASH)).toBe(true);
    logged.mockRestore();
  });

  it('does not count a failed mark when the counted entity could not be written', async () => {
    const claim = await ledger.reserve(HASH, PARTICIPANT);
    wallet.createEntity.mockRejectedValueOnce(new Error('rpc down'));

    await expect(ledger.mark(HASH, PARTICIPANT, claim)).rejects.toThrow('rpc down');

    expect(wallet.deleteEntity).not.toHaveBeenCalled();
    expect(arkiv.entities.map((e) => e.key)).toEqual([claim]);
  });

  it('only trusts entries written by its own signer', async () => {
    await createArkivLedger(
      arkiv.publicClient as never,
      arkiv.walletClient(OTHER) as never
    ).reserve(HASH, PARTICIPANT);

    expect(await ledger.has(HASH)).toBe(false);
  });

  it('matches the activity case-insensitively', async () => {
    await ledger.reserve(HASH, PARTICIPANT);

    expect(await ledger.has(HASH.toUpperCase().replace('0X', '0x') as `0x${string}`)).toBe(true);
  });
});
