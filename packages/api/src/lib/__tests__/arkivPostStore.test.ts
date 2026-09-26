import { describe, expect, it } from 'vitest';
import { PostSchema, postAttributes, postFromEntity } from '../arkivPostStore.js';

const ME = '0xA9e9Bcaa4Fb2BD6C3C770e88eCB085f2E92B10cb';

const entity = (body: unknown, extra: Record<string, unknown> = {}) => ({
  key: '0xkey',
  attributes: { author: { type: 'addr', value: ME }, ...extra } as never,
  toJson: () => body,
});

describe('postAttributes', () => {
  it('stores the same value whatever the wallet’s letter case', () => {
    expect(postAttributes(ME as `0x${string}`, 1)).toEqual(
      postAttributes(ME.toLowerCase() as `0x${string}`, 1)
    );
  });

  it('is its own named schema, which is what keeps posts apart from other records', () => {
    expect(PostSchema.name).toBe('post');
  });

  it('records the client id so a retry can find the post', () => {
    expect(postAttributes(ME as `0x${string}`, 1, 'client-1').client_id).toMatchObject({
      type: 'str',
      value: 'client-1',
    });
  });

  it('records when it was posted, in unix seconds', () => {
    expect(postAttributes(ME as `0x${string}`, 1_700_000_000).created_at).toMatchObject({
      type: 'u64',
      value: 1_700_000_000n,
    });
  });
});

describe('postFromEntity', () => {
  it('reads the author (lowercase), text, photos and time back', () => {
    expect(
      postFromEntity(
        entity(
          { text: 'hi', photos: ['bafy1'] },
          {
            created_at: { type: 'u64', value: 1_700_000_000n },
            client_id: { type: 'str', value: 'client-1' },
          }
        )
      )
    ).toEqual({
      id: '0xkey',
      author: ME.toLowerCase(),
      text: 'hi',
      photos: ['bafy1'],
      createdAt: 1_700_000_000,
      clientId: 'client-1',
    });
  });

  it('reads a post stored before client ids existed with an empty one', () => {
    expect(postFromEntity(entity({ text: 'hi', photos: [] }))?.clientId).toBe('');
  });

  it('skips an entity with no author, a payload of the wrong shape, or unreadable JSON', () => {
    expect(
      postFromEntity({ key: 'k', attributes: {}, toJson: () => ({ text: '', photos: [] }) })
    ).toBeNull();
    expect(postFromEntity(entity({ text: 5, photos: [] }))).toBeNull();
    expect(postFromEntity(entity({ text: 'x', photos: 'bafy' }))).toBeNull();
    expect(postFromEntity(entity({ text: 'x', photos: [1] }))).toBeNull();
    expect(postFromEntity(entity(null))).toBeNull();
    expect(
      postFromEntity({
        key: 'k',
        attributes: { author: { type: 'addr', value: ME } },
        toJson: () => {
          throw new Error('not json');
        },
      })
    ).toBeNull();
  });
});
