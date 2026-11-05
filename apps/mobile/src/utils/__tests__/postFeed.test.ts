import { describe, expect, it } from 'vitest';
import {
  mergeByTime,
  orphanedPosts,
  type PostEntry,
  postAuthors,
  postPhotoUri,
  postStatusLine,
  postsBy,
  postsForScope,
} from '@/utils/postFeed';

const ME = '0x00000000000000000000000000000000000000aa';
const A = '0x00000000000000000000000000000000000000bb';
const B = '0x00000000000000000000000000000000000000cc';

const post = (id: string, author: string, createdAt: number): PostEntry => ({
  id,
  author,
  text: id,
  photos: [],
  createdAt,
});

describe('postsForScope', () => {
  const posts = [post('mine', ME, 3), post('a', A, 2), post('b', B, 1)];
  const following = new Set([A.toLowerCase()]);

  it('shows everyone’s posts to Everyone', () => {
    expect(postsForScope(posts, 'Everyone', ME, following).map((p) => p.id)).toEqual([
      'mine',
      'a',
      'b',
    ]);
  });

  it('shows posts from the athletes you follow, and your own, to Following', () => {
    expect(postsForScope(posts, 'Following', ME, following).map((p) => p.id)).toEqual([
      'mine',
      'a',
    ]);
  });

  it('shows only your own posts to You, whatever the letter case', () => {
    expect(
      postsForScope(posts, 'You', ME.toUpperCase().replace('0X', '0x'), following).map((p) => p.id)
    ).toEqual(['mine']);
  });
});

describe('mergeByTime', () => {
  const entry = (id: string, time: number) => ({ id, time });

  it('interleaves two lists newest first, keeping each list’s own order for ties', () => {
    const merged = mergeByTime(
      [entry('a1', 30), entry('a2', 10)],
      [entry('p1', 20), entry('p2', 10)],
      (e) => e.time
    );

    expect(merged.map((e) => e.id)).toEqual(['a1', 'p1', 'a2', 'p2']);
  });

  it('returns the other list when one is empty', () => {
    const only = [entry('x', 1)];

    expect(mergeByTime(only, [], (e) => e.time)).toEqual(only);
    expect(mergeByTime([], only, (e) => e.time)).toEqual(only);
  });
});

describe('postPhotoUri', () => {
  it('loads a published photo from its content id through the gateway', () => {
    expect(postPhotoUri('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(
      'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
    );
  });

  it('leaves a photo that is still on this device as it is', () => {
    expect(postPhotoUri('file:///data/cache/a.jpg')).toBe('file:///data/cache/a.jpg');
    expect(postPhotoUri('content://media/external/1')).toBe('content://media/external/1');
    expect(postPhotoUri('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
});

describe('postAuthors', () => {
  it('asks about you first, then who you follow, then everyone else, without repeats', () => {
    const authors = postAuthors(ME, new Set([A.toLowerCase()]), [A, B, ME.toLowerCase()]);

    expect(authors).toEqual([ME.toLowerCase(), A.toLowerCase(), B.toLowerCase()]);
  });

  it('never asks about more authors than the server accepts at once', () => {
    const many = Array.from(
      { length: 300 },
      (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`
    );

    expect(postAuthors(ME, new Set(), many)).toHaveLength(100);
    expect(postAuthors(ME, new Set(), many)[0]).toBe(ME.toLowerCase());
  });

  it('still asks about you when you know no one else', () => {
    expect(postAuthors(ME, new Set(), [])).toEqual([ME.toLowerCase()]);
  });
});

describe('postsBy', () => {
  it('lists one author’s posts newest first, whatever the letter case', () => {
    const all = [post('old', A, 1), post('other', B, 5), post('new', A, 9)];

    expect(postsBy(all, A.toUpperCase().replace('0X', '0x')).map((p) => p.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('is empty for an author with none', () => {
    expect(postsBy([post('x', A, 1)], B)).toEqual([]);
  });
});

describe('orphanedPosts', () => {
  const pending = (id: string): PostEntry => ({ ...post(id, ME, 5), pending: true });
  const entry = (key: string) => ({ key }) as never;

  it('finds pending posts with nothing queued to send them', () => {
    const posts = [pending('local:a'), pending('local:b'), post('published', ME, 1)];

    expect(orphanedPosts(posts, [entry('post:local:a')]).map((p) => p.id)).toEqual(['local:b']);
  });

  it('finds none when every pending post is queued, or none is pending', () => {
    expect(orphanedPosts([pending('local:a')], [entry('post:local:a')])).toEqual([]);
    expect(orphanedPosts([post('p', ME, 1)], [])).toEqual([]);
  });
});

describe('postStatusLine', () => {
  const sent = post('p', ME, 5);

  it('shows how long ago a sent post was written', () => {
    expect(postStatusLine(sent, undefined, 'just now')).toEqual({
      text: 'just now',
      failed: false,
    });
  });

  it('says a post is sending while it waits, and again after a failed try', () => {
    const pending = { ...sent, pending: true };

    expect(postStatusLine(pending, 'sending', 'x')).toEqual({ text: 'Sending…', failed: false });
    expect(postStatusLine(pending, 'retrying', 'x')).toEqual({ text: 'Sending…', failed: false });
    expect(postStatusLine(pending, undefined, 'x')).toEqual({ text: 'Sending…', failed: false });
  });

  it('says when a post waits for a connection or is slow', () => {
    const pending = { ...sent, pending: true };
    expect(postStatusLine(pending, 'waiting-for-network', 'x').text).toBe(
      'Waiting for a connection'
    );
    expect(postStatusLine(pending, 'stuck', 'x')).toEqual({
      text: 'Taking longer than usual',
      failed: false,
    });
  });

  it('says so when the automatic tries are used up, so it can be retried', () => {
    expect(postStatusLine({ ...sent, pending: true }, 'failed', 'x')).toEqual({
      text: "Couldn't send",
      failed: true,
    });
  });
});
