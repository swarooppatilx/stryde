import { describe, expect, it, vi } from 'vitest';
import { RejectedError } from '@/backends/outbox/outbox';
import { createPostHandlers, type PostIntentDeps } from '@/services/postIntents';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const wallet = { account: { address: ME } } as never;

function setup(over: Partial<PostIntentDeps> = {}) {
  const deps: PostIntentDeps = {
    wallet: () => wallet,
    uploadImage: vi.fn(async (uri: string) => `cid-of-${uri.split('/').pop()}`),
    createPost: vi.fn(async (_wallet, post) => ({
      id: 'server-1',
      author: ME,
      text: post.text,
      photos: post.photos,
      createdAt: 100,
    })),
    deletePost: vi.fn(async () => {}),
    onPublished: vi.fn(),
    ...over,
  };
  return { deps, handlers: createPostHandlers(deps) };
}

const intent = (over: Record<string, unknown> = {}) => ({
  localId: 'local:1',
  clientId: 'client-1',
  text: 'Great run',
  photoUris: [] as string[],
  ...over,
});

describe('createPost', () => {
  it('pins each photo, publishes the post with their content ids, and swaps the local post for the published one', async () => {
    const { deps, handlers } = setup();

    await handlers.createPost(intent({ photoUris: ['file:///a.jpg', 'file:///b.jpg'] }));

    expect(deps.uploadImage).toHaveBeenCalledTimes(2);
    expect(deps.createPost).toHaveBeenCalledWith(wallet, {
      text: 'Great run',
      photos: ['cid-of-a.jpg', 'cid-of-b.jpg'],
      clientId: 'client-1',
    });
    expect(deps.onPublished).toHaveBeenCalledWith(
      'local:1',
      expect.objectContaining({ id: 'server-1', text: 'Great run' })
    );
  });

  it('keeps the photos in the order they were picked', async () => {
    const { deps, handlers } = setup({
      uploadImage: vi.fn(async (uri: string) => {
        // The first photo takes longest to pin, but must still come first.
        if (uri.endsWith('a.jpg')) await new Promise((resolve) => setTimeout(resolve, 5));
        return `cid-${uri.split('/').pop()}`;
      }),
    });

    await handlers.createPost(intent({ photoUris: ['file:///a.jpg', 'file:///b.jpg'] }));

    expect(deps.createPost).toHaveBeenCalledWith(wallet, {
      text: 'Great run',
      photos: ['cid-a.jpg', 'cid-b.jpg'],
      clientId: 'client-1',
    });
  });

  it('waits when there is no wallet yet, without uploading anything', async () => {
    const { deps, handlers } = setup({ wallet: () => null });

    await expect(handlers.createPost(intent({ photoUris: ['file:///a.jpg'] }))).rejects.toThrow(
      'No wallet yet'
    );
    expect(deps.uploadImage).not.toHaveBeenCalled();
  });

  it('refuses for good when the server says no (limit reached, bad text)', async () => {
    const refusal = Object.assign(new Error('You have posted a lot today'), { status: 429 });
    const { handlers } = setup({ createPost: vi.fn().mockRejectedValue(refusal) });

    await expect(handlers.createPost(intent())).rejects.toBeInstanceOf(RejectedError);
  });

  it('retries a photo that would not pin, or a server that is down', async () => {
    for (const failure of [
      new Error('network'),
      Object.assign(new Error('boom'), { status: 503 }),
    ]) {
      const { handlers } = setup({ createPost: vi.fn().mockRejectedValue(failure) });
      await expect(handlers.createPost(intent())).rejects.not.toBeInstanceOf(RejectedError);
    }
    const { handlers } = setup({ uploadImage: vi.fn().mockRejectedValue(new Error('ipfs down')) });
    await expect(
      handlers.createPost(intent({ photoUris: ['file:///a.jpg'] }))
    ).rejects.not.toBeInstanceOf(RejectedError);
  });
});

describe('retrying a post', () => {
  it('sends the same client id every time, so a retry cannot publish the post twice', async () => {
    const createPost = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ id: 's', author: ME, text: 'Great run', photos: [], createdAt: 1 });
    const { handlers } = setup({ createPost });

    await expect(handlers.createPost(intent())).rejects.toThrow('network');
    await handlers.createPost(intent());

    expect(createPost.mock.calls.map(([, post]) => post.clientId)).toEqual([
      'client-1',
      'client-1',
    ]);
  });
});

describe('deletePost', () => {
  it('asks the server to remove the post', async () => {
    const { deps, handlers } = setup();

    await handlers.deletePost({ postId: 'server-1' });

    expect(deps.deletePost).toHaveBeenCalledWith(wallet, 'server-1');
  });

  it('waits when there is no wallet yet', async () => {
    const { handlers } = setup({ wallet: () => null });

    await expect(handlers.deletePost({ postId: 'x' })).rejects.toThrow('No wallet yet');
  });

  it('refuses for good on a 4xx and retries otherwise', async () => {
    const refused = setup({
      deletePost: vi.fn().mockRejectedValue(Object.assign(new Error('not yours'), { status: 403 })),
    });
    await expect(refused.handlers.deletePost({ postId: 'x' })).rejects.toBeInstanceOf(
      RejectedError
    );

    const down = setup({ deletePost: vi.fn().mockRejectedValue(new Error('network')) });
    await expect(down.handlers.deletePost({ postId: 'x' })).rejects.not.toBeInstanceOf(
      RejectedError
    );
  });
});
