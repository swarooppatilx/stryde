import { describe, expect, it, vi } from 'vitest';
import {
  type PostActionDeps,
  publishPost,
  removePost,
  requeueOrphans,
} from '@/services/postActions';

const ME = '0x00000000000000000000000000000000000000aa';

function setup(over: Partial<PostActionDeps> = {}) {
  const deps: PostActionDeps = {
    author: () => ME,
    now: () => 1_700_000_000_000,
    newId: () => 'abc',
    addPending: vi.fn(),
    remove: vi.fn(),
    enqueue: vi.fn(async () => {}),
    ...over,
  };
  return deps;
}

describe('publishPost', () => {
  it('shows the post at once and queues it with its photos', async () => {
    const deps = setup();

    const result = await publishPost(deps, { text: '  Great run ', photoUris: ['file:///a.jpg'] });

    expect(result).toEqual({ ok: true });
    expect(deps.addPending).toHaveBeenCalledWith({
      id: 'local:abc',
      author: ME,
      text: 'Great run',
      photos: ['file:///a.jpg'],
      createdAt: 1_700_000_000,
    });
    expect(deps.enqueue).toHaveBeenCalledWith({
      kind: 'createPost',
      key: 'post:local:abc',
      payload: {
        localId: 'local:abc',
        clientId: 'abc',
        text: 'Great run',
        photoUris: ['file:///a.jpg'],
      },
    });
  });

  it('allows a photo with no text, and text with no photo', async () => {
    expect((await publishPost(setup(), { text: '', photoUris: ['file:///a.jpg'] })).ok).toBe(true);
    expect((await publishPost(setup(), { text: 'hi', photoUris: [] })).ok).toBe(true);
  });

  it.each([
    [{ text: '   ', photoUris: [] }, 'Write something or add a photo'],
    [{ text: 'x'.repeat(501), photoUris: [] }, 'A post can be at most 500 characters'],
    [
      { text: 'hi', photoUris: ['a', 'b', 'c', 'd', 'e'].map((n) => `file:///${n}.jpg`) },
      'A post can have at most 4 photos',
    ],
    [{ text: 'bell\u0007', photoUris: [] }, 'Posts cannot contain control characters'],
  ])('refuses what the server would refuse, without touching anything', async (input, error) => {
    const deps = setup();

    expect(await publishPost(deps, input)).toEqual({ ok: false, error });
    expect(deps.addPending).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it('keeps line breaks', async () => {
    const deps = setup();

    await publishPost(deps, { text: 'one\ntwo', photoUris: [] });

    expect(deps.addPending).toHaveBeenCalledWith(expect.objectContaining({ text: 'one\ntwo' }));
  });
});

describe('removePost', () => {
  it('removes the post at once and queues the removal', async () => {
    const deps = setup();

    await removePost(deps, 'server-1');

    expect(deps.remove).toHaveBeenCalledWith('server-1');
    expect(deps.enqueue).toHaveBeenCalledWith({
      kind: 'deletePost',
      key: 'post:delete:server-1',
      payload: { postId: 'server-1' },
    });
  });

  it('does not queue a removal for a post still being sent', async () => {
    const deps = setup();

    await removePost(deps, 'local:abc');

    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});

describe('requeueOrphans', () => {
  const orphan = {
    id: 'local:abc',
    author: ME,
    text: 'stuck',
    photos: ['file:///a.jpg'],
    createdAt: 1,
    pending: true,
  };

  it('queues each stuck post again with the client id it was first given', async () => {
    const deps = setup();

    await requeueOrphans(deps, [orphan], []);

    expect(deps.enqueue).toHaveBeenCalledWith({
      kind: 'createPost',
      key: 'post:local:abc',
      payload: {
        localId: 'local:abc',
        clientId: 'abc',
        text: 'stuck',
        photoUris: ['file:///a.jpg'],
      },
    });
  });

  it('leaves posts that are already queued alone', async () => {
    const deps = setup();

    await requeueOrphans(deps, [orphan], [{ key: 'post:local:abc' }]);

    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});
