import { describe, expect, it, vi } from 'vitest';
import {
  createFollowService,
  FollowError,
  type FollowRecord,
  type FollowStore,
} from '../follows.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const THIRD = '0x00000000000000000000000000000000000000cc' as const;
const NOW = 1_000_000;
const SIGNATURE = '0xsigned' as const;

function memoryStore(): FollowStore & { records: FollowRecord[]; writes: number } {
  const records: FollowRecord[] = [];
  const store = {
    records,
    writes: 0,
    async find(follower: string, followee: string) {
      return records.find((r) => r.follower === follower && r.followee === followee) ?? null;
    },
    async create(input: { follower: `0x${string}`; followee: `0x${string}` }) {
      store.writes += 1;
      await Promise.resolve();
      const record = { entityKey: `key-${records.length + 1}`, followedAt: NOW, ...input };
      records.push(record);
      return record;
    },
    async remove(entityKey: string) {
      const index = records.findIndex((r) => r.entityKey === entityKey);
      if (index >= 0) records.splice(index, 1);
    },
    async removeAllFor(address: string) {
      const gone = records.filter((r) => r.follower === address || r.followee === address);
      for (const record of gone) records.splice(records.indexOf(record), 1);
      return gone.length;
    },
    async following(follower: string) {
      return { entries: records.filter((r) => r.follower === follower), truncated: false };
    },
    async followers(followee: string) {
      return { entries: records.filter((r) => r.followee === followee), truncated: false };
    },
  };
  return store;
}

function setup(verify: (...args: never[]) => Promise<boolean> = async () => true) {
  const store = memoryStore();
  const service = createFollowService({ store, verify: verify as never, now: () => NOW });
  return { store, service };
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  follower: ME,
  followee: THEM,
  action: 'follow' as const,
  deadline: NOW + 60,
  ...overrides,
});

const code = async (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error) => (error instanceof FollowError ? error.code : 'other')
  );

describe('following someone', () => {
  it('records the follow once the signature checks out', async () => {
    const { service, store } = setup();

    const result = await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(result).toEqual({ following: true, created: true });
    expect(store.records).toHaveLength(1);
  });

  it('is idempotent: following twice writes once', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    const again = await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(again).toEqual({ following: true, created: false });
    expect(store.writes).toBe(1);
  });

  it('writes once even when two identical requests arrive at the same moment', async () => {
    const { service, store } = setup();

    await Promise.all([
      service.apply({ intent: intent(), signature: SIGNATURE }),
      service.apply({ intent: intent(), signature: SIGNATURE }),
    ]);

    expect(store.writes).toBe(1);
  });

  it('treats the same wallet in a different letter case as the same follower', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    await service.apply({
      intent: intent({ follower: ME.toUpperCase().replace('0X', '0x') }),
      signature: SIGNATURE,
    });

    expect(store.writes).toBe(1);
  });
});

describe('unfollowing', () => {
  it('removes the follow', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    const result = await service.apply({
      intent: intent({ action: 'unfollow' }),
      signature: SIGNATURE,
    });

    expect(result).toEqual({ following: false, created: false });
    expect(store.records).toHaveLength(0);
  });

  it('is fine when there was nothing to remove', async () => {
    const { service } = setup();

    const result = await service.apply({
      intent: intent({ action: 'unfollow' }),
      signature: SIGNATURE,
    });

    expect(result.following).toBe(false);
  });
});

describe('what is refused', () => {
  it('a signature that does not verify, without touching the store', async () => {
    const { service, store } = setup(async () => false);

    expect(await code(service.apply({ intent: intent(), signature: SIGNATURE }))).toBe(
      'bad_signature'
    );
    expect(store.writes).toBe(0);
  });

  it('an intent whose deadline has passed', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ deadline: NOW - 1 }), signature: SIGNATURE }))
    ).toBe('expired');
  });

  it('a deadline set far in the future, so a signature cannot be kept around', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ deadline: NOW + 3600 }), signature: SIGNATURE }))
    ).toBe('expired');
  });

  it('following yourself', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ followee: ME }), signature: SIGNATURE }))
    ).toBe('self_follow');
  });

  it.each([
    ['a malformed address', { followee: 'bob' }],
    ['an unknown action', { action: 'block' }],
    ['a non-numeric deadline', { deadline: 'soon' }],
  ])('%s', async (_name, override) => {
    const { service } = setup();

    expect(await code(service.apply({ intent: intent(override), signature: SIGNATURE }))).toBe(
      'invalid'
    );
  });

  it('a missing signature', async () => {
    const { service } = setup();

    expect(await code(service.apply({ intent: intent(), signature: '' as never }))).toBe('invalid');
  });

  it('passes exactly the signed fields to the signature check', async () => {
    const verify = vi.fn(async () => true);
    const { service } = setup(verify);

    await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(verify).toHaveBeenCalledWith(intent(), SIGNATURE);
  });
});

describe('reading follows', () => {
  it('lists who someone follows and who follows them, with counts', async () => {
    const { service } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });
    await service.apply({
      intent: intent({ follower: THIRD, followee: THEM }),
      signature: SIGNATURE,
    });

    expect(await service.following(ME)).toEqual({ addresses: [THEM], truncated: false });
    expect(await service.followers(THEM)).toEqual({
      addresses: [ME, THIRD],
      entries: [
        { address: ME, followedAt: NOW },
        { address: THIRD, followedAt: NOW },
      ],
      truncated: false,
    });
  });

  it('rejects an address that is not an address', async () => {
    const { service } = setup();

    expect(await code(service.following('nope'))).toBe('invalid');
  });
});

describe('onFollowed', () => {
  const build = (onFollowed: (a: never, b: never) => unknown) =>
    createFollowService({
      store: memoryStore(),
      verify: (async () => true) as never,
      now: () => NOW,
      onFollowed: onFollowed as never,
    });

  it('tells the followee once about a new follow only', async () => {
    const onFollowed = vi.fn();
    const service = build(onFollowed);

    await service.apply({ intent: intent(), signature: SIGNATURE });
    await service.apply({ intent: intent(), signature: SIGNATURE });
    await service.apply({ intent: intent({ action: 'unfollow' }), signature: SIGNATURE });

    expect(onFollowed).toHaveBeenCalledTimes(1);
    expect(onFollowed).toHaveBeenCalledWith(ME, THEM);
  });

  it('still completes the follow when telling the followee fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = build(() => Promise.reject(new Error('push down')));

    const result = await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(result).toEqual({ following: true, created: true });
  });
});
