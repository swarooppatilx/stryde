import { describe, expect, it, vi } from 'vitest';
import { createArkivCommentLikeStore } from '../arkivCommentLikeStore.js';
import { createArkivFollowStore } from '../arkivFollowStore.js';
import { createArkivPostStore } from '../arkivPostStore.js';
import { createArkivAboutStore } from '../arkivProfileAboutStore.js';
import { createArkivPushTokenStore } from '../arkivPushTokenStore.js';
import { createArkivReportStore } from '../arkivReportStore.js';

const CREATOR = '0x00000000000000000000000000000000000000aa';
const ME = '0x00000000000000000000000000000000000000bb' as const;

/** A node holding `keys`; a delete takes the key out, so a second read finds fewer. */
function fakes(keys: string[]) {
  const rows = keys.map((k) => ({ $key: k }));
  const wheres: unknown[][] = [];
  const publicClient = {
    select: () => {
      let limit = 100;
      let offset = 0;
      const query = {
        from: () => query,
        createdBy: () => query,
        where: (...expressions: unknown[]) => {
          wheres.push(expressions);
          return query;
        },
        orderBy: () => query,
        limit: (n: number) => {
          limit = n;
          return query;
        },
        offset: (n: number) => {
          offset = n;
          return query;
        },
        fetch: async () => ({ entities: rows.slice(offset, offset + limit), skipped: 0 }),
      };
      return query;
    },
  };
  const deleteEntity = vi.fn(async ({ entityKey }: { entityKey: string }) => {
    rows.splice(
      rows.findIndex((r) => r.$key === entityKey),
      1
    );
    return {};
  });
  const walletClient = { account: { address: CREATOR }, deleteEntity };
  return {
    publicClient: publicClient as never,
    walletClient: walletClient as never,
    deleteEntity,
    wheres,
    rows,
  };
}

const stores = [
  ['follows', createArkivFollowStore],
  ['posts', createArkivPostStore],
  ['about text', createArkivAboutStore],
  ['comment likes', createArkivCommentLikeStore],
  ['reports', createArkivReportStore],
  ['push tokens', createArkivPushTokenStore],
] as const;

describe.each(stores)('removeAllFor on %s', (_name, create) => {
  it('deletes what matches the wallet and counts it', async () => {
    const node = fakes(['0x01', '0x02', '0x03']);
    const store = create(node.publicClient, node.walletClient) as unknown as {
      removeAllFor(a: typeof ME): Promise<number>;
    };

    expect(await store.removeAllFor(ME)).toBe(3);
    expect(node.deleteEntity).toHaveBeenCalledTimes(3);
    expect(node.rows).toHaveLength(0);
    expect(node.wheres[0]).toHaveLength(1);
  });

  it('removes nothing when the wallet has no records', async () => {
    const node = fakes([]);
    const store = create(node.publicClient, node.walletClient) as unknown as {
      removeAllFor(a: typeof ME): Promise<number>;
    };

    expect(await store.removeAllFor(ME)).toBe(0);
    expect(node.deleteEntity).not.toHaveBeenCalled();
  });
});
