import { describe, expect, it } from 'vitest';
import { FollowSchema, followAttributes, followFromEntity } from '../arkivFollowStore.js';

const ME = '0xA9e9Bcaa4Fb2BD6C3C770e88eCB085f2E92B10cb';
const THEM = '0x000000000000000000000000000000000000dEaD';

describe('followAttributes timestamp', () => {
  it('records when the follow happened, in unix seconds', () => {
    const attributes = followAttributes(ME, THEM, 1_700_000_000);

    expect(attributes.followed_at).toMatchObject({ type: 'u64', value: 1_700_000_000n });
  });
});

describe('followAttributes', () => {
  it('stores the same value whatever letter case the wallet arrives in', () => {
    expect(followAttributes(ME.toLowerCase() as `0x${string}`, THEM, 1)).toEqual(
      followAttributes(ME, THEM.toLowerCase() as `0x${string}`, 1)
    );
  });

  it('is its own named schema, so only follows are matched', () => {
    expect(FollowSchema.name).toBe('follow');
  });
});

describe('followFromEntity', () => {
  const entity = {
    key: '0xkey',
    attributes: {
      follower: { type: 'addr', value: ME },
      followee: { type: 'addr', value: THEM },
    },
  };

  it('reads the wallets back, lowercase', () => {
    expect(followFromEntity(entity)).toEqual({
      entityKey: '0xkey',
      follower: ME.toLowerCase(),
      followee: THEM.toLowerCase(),
      followedAt: 0,
    });
  });

  it('reads when the follow happened', () => {
    const withTime = {
      ...entity,
      attributes: { ...entity.attributes, followed_at: { type: 'u64', value: 1_700_000_000n } },
    };

    expect(followFromEntity(withTime)?.followedAt).toBe(1_700_000_000);
  });

  it('reports 0 for a follow written before timestamps existed', () => {
    expect(followFromEntity(entity)?.followedAt).toBe(0);
  });

  it('skips an entity that is missing a wallet', () => {
    expect(
      followFromEntity({ key: '0xkey', attributes: { follower: entity.attributes.follower } })
    ).toBeNull();
  });

  it('skips an entity whose wallet is not an address', () => {
    expect(
      followFromEntity({
        key: '0xkey',
        attributes: { ...entity.attributes, followee: { type: 'str', value: 'bob' } },
      })
    ).toBeNull();
  });
});
