import { describe, expect, it } from 'vitest';
import { AboutSchema, aboutAttributes, aboutFromEntity } from '../arkivProfileAboutStore.js';

const ME = '0xA9e9Bcaa4Fb2BD6C3C770e88eCB085f2E92B10cb';

const entity = (body: unknown, extra: Record<string, unknown> = {}) => ({
  key: '0xkey',
  attributes: { author: { type: 'addr', value: ME }, ...extra } as never,
  toJson: () => body,
});

describe('aboutAttributes', () => {
  it('stores the same value whatever the wallet’s letter case', () => {
    expect(aboutAttributes(ME as `0x${string}`, 1)).toEqual(
      aboutAttributes(ME.toLowerCase() as `0x${string}`, 1)
    );
  });

  it('is its own named schema', () => {
    expect(AboutSchema.name).toBe('profile_about');
  });

  it('records when it was saved, in unix seconds', () => {
    expect(aboutAttributes(ME as `0x${string}`, 1_700_000_000).updated_at).toMatchObject({
      type: 'u64',
      value: 1_700_000_000n,
    });
  });
});

describe('aboutFromEntity', () => {
  it('reads the author (lowercase) and the text back', () => {
    expect(
      aboutFromEntity(
        entity(
          { bio: 'hi', location: 'Pune' },
          { updated_at: { type: 'u64', value: 1_700_000_000n } }
        )
      )
    ).toEqual({
      entityKey: '0xkey',
      author: ME.toLowerCase(),
      bio: 'hi',
      location: 'Pune',
      updatedAt: 1_700_000_000,
    });
  });

  it('reports 0 when there is no timestamp', () => {
    expect(aboutFromEntity(entity({ bio: '', location: 'x' }))?.updatedAt).toBe(0);
  });

  it('skips an entity with no author, a bad author, or a payload that is not text fields', () => {
    expect(
      aboutFromEntity({ key: 'k', attributes: {}, toJson: () => ({ bio: '', location: '' }) })
    ).toBeNull();
    expect(
      aboutFromEntity({
        key: 'k',
        attributes: { author: { type: 'str', value: 'bob' } },
        toJson: () => ({ bio: '', location: '' }),
      })
    ).toBeNull();
    expect(aboutFromEntity(entity({ bio: 5, location: 'x' }))).toBeNull();
    expect(aboutFromEntity(entity(null))).toBeNull();
    expect(
      aboutFromEntity({
        key: 'k',
        attributes: { author: { type: 'addr', value: ME } },
        toJson: () => {
          throw new Error('not json');
        },
      })
    ).toBeNull();
  });
});
