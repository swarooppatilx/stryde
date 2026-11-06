import { describe, expect, it, vi } from 'vitest';
import {
  CommentLikeError,
  type CommentLikeRecord,
  type CommentLikeStore,
  createCommentLikeService,
} from '../commentLikes.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const COMMENT = `0x${'11'.repeat(32)}` as const;
const OTHER_COMMENT = `0x${'22'.repeat(32)}` as const;
const NOW = 1_000_000;
const SIGNATURE = '0xsigned' as const;

function memoryStore(): CommentLikeStore & { records: CommentLikeRecord[]; writes: number } {
  const records: CommentLikeRecord[] = [];
  const store = {
    records,
    writes: 0,
    async find(liker: string, commentId: string) {
      return records.find((r) => r.liker === liker && r.commentId === commentId) ?? null;
    },
    async create(input: { liker: `0x${string}`; commentId: `0x${string}` }) {
      store.writes += 1;
      await Promise.resolve();
      const record = { entityKey: `key-${records.length + 1}`, likedAt: NOW, ...input };
      records.push(record);
      return record;
    },
    async remove(entityKey: string) {
      const index = records.findIndex((r) => r.entityKey === entityKey);
      if (index >= 0) records.splice(index, 1);
    },
    async removeAllFor(liker: string) {
      const gone = records.filter((r) => r.liker === liker);
      for (const record of gone) records.splice(records.indexOf(record), 1);
      return gone.length;
    },
    async likers(commentId: string) {
      return { entries: records.filter((r) => r.commentId === commentId), truncated: false };
    },
  };
  return store;
}

function setup(verify: (...args: never[]) => Promise<boolean> = async () => true) {
  const store = memoryStore();
  const service = createCommentLikeService({ store, verify: verify as never, now: () => NOW });
  return { store, service };
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  liker: ME,
  commentId: COMMENT,
  action: 'like' as const,
  deadline: NOW + 60,
  ...overrides,
});

const code = async (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error) => (error instanceof CommentLikeError ? error.code : 'other')
  );

describe('liking a comment', () => {
  it('records the like once the signature checks out', async () => {
    const { service, store } = setup();

    const result = await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(result).toEqual({ liked: true, created: true });
    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({ liker: ME, commentId: COMMENT });
  });

  it('is idempotent: liking again writes nothing', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    const again = await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(again).toEqual({ liked: true, created: false });
    expect(store.writes).toBe(1);
  });

  it('treats addresses and comment ids case-insensitively', async () => {
    const { service, store } = setup();

    await service.apply({
      intent: intent({
        liker: ME.toUpperCase().replace('0X', '0x'),
        commentId: COMMENT.toUpperCase().replace('0X', '0x'),
      }),
      signature: SIGNATURE,
    });
    await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(store.records).toHaveLength(1);
  });

  it('keeps simultaneous taps to one like', async () => {
    const { service, store } = setup();

    await Promise.all([
      service.apply({ intent: intent(), signature: SIGNATURE }),
      service.apply({ intent: intent(), signature: SIGNATURE }),
    ]);

    expect(store.records).toHaveLength(1);
  });
});

describe('unliking', () => {
  it('removes the like', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    const result = await service.apply({
      intent: intent({ action: 'unlike' }),
      signature: SIGNATURE,
    });

    expect(result).toEqual({ liked: false, created: false });
    expect(store.records).toHaveLength(0);
  });

  it('is harmless when there was no like', async () => {
    const { service } = setup();

    expect(
      await service.apply({ intent: intent({ action: 'unlike' }), signature: SIGNATURE })
    ).toEqual({ liked: false, created: false });
  });
});

describe('refusing a bad request', () => {
  it('rejects a signature that is not the liker’s, writing nothing', async () => {
    const { service, store } = setup(async () => false);

    expect(await code(service.apply({ intent: intent(), signature: SIGNATURE }))).toBe(
      'bad_signature'
    );
    expect(store.writes).toBe(0);
  });

  it('rejects an expired or too-far-future deadline', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ deadline: NOW - 1 }), signature: SIGNATURE }))
    ).toBe('expired');
    expect(
      await code(
        service.apply({ intent: intent({ deadline: NOW + 10_000 }), signature: SIGNATURE })
      )
    ).toBe('expired');
  });

  it('rejects malformed input before looking at the signature', async () => {
    const verify = vi.fn(async () => true);
    const { service } = setup(verify);

    for (const bad of [
      intent({ liker: 'nope' }),
      intent({ commentId: '0x1234' }),
      intent({ action: 'toggle' }),
      intent({ deadline: 'soon' }),
      null,
    ]) {
      expect(await code(service.apply({ intent: bad, signature: SIGNATURE }))).toBe('invalid');
    }
    expect(await code(service.apply({ intent: intent(), signature: '' }))).toBe('invalid');
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('reading likes', () => {
  it('lists who liked each comment, with every asked-for comment present', async () => {
    const { service } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });
    await service.apply({ intent: intent({ liker: THEM }), signature: SIGNATURE });

    const likes = await service.likesFor([COMMENT, OTHER_COMMENT]);

    expect(likes.likes[COMMENT]).toEqual([ME, THEM]);
    expect(likes.likes[OTHER_COMMENT]).toEqual([]);
  });

  it('refuses a malformed id or a huge list', async () => {
    const { service } = setup();

    expect(await code(service.likesFor(['nope']))).toBe('invalid');
    expect(await code(service.likesFor(Array.from({ length: 101 }, () => COMMENT)))).toBe(
      'invalid'
    );
    expect(await code(service.likesFor('not-a-list'))).toBe('invalid');
  });

  it('asks for each distinct comment only once', async () => {
    const { service, store } = setup();
    const spy = vi.spyOn(store, 'likers');

    await service.likesFor([COMMENT, COMMENT.toUpperCase().replace('0X', '0x'), OTHER_COMMENT]);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
