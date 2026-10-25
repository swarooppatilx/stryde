import { services, setIpfsConfig } from '@repo/shared';
import { privateKeyToAccount } from 'viem/accounts';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSandboxApi } from '@/backends/sandbox/sandboxApi';
import { installFakePlatform } from '@/platform/fakes';
import { publishPost } from '@/services/postActions';
import { createPostHandlers } from '@/services/postIntents';

installFakePlatform();
const { usePostStore } = await import('@/stores/postStore');

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const wallet = {
  account,
  signTypedData: (typed: Parameters<typeof account.signTypedData>[0]) =>
    account.signTypedData(typed),
} as never;

beforeEach(() => {
  installFakePlatform();
  usePostStore.getState().reset();
  setIpfsConfig({ apiUrl: 'http://api.test', fetch: createSandboxApi().fetch });
});

describe('writing a post, start to finish (fake API)', () => {
  it('shows pending at once, and after delivery only the published post remains', async () => {
    const queued: { kind: string; payload: unknown }[] = [];
    await publishPost(
      {
        author: () => account.address,
        now: () => 1_700_000_000_000,
        newId: () => 'abc',
        addPending: usePostStore.getState().addPending,
        remove: usePostStore.getState().remove,
        enqueue: async (entry) => void queued.push(entry),
      },
      { text: 'hello', photoUris: [] }
    );
    expect(Object.values(usePostStore.getState().posts)).toMatchObject([
      { id: 'local:abc', pending: true },
    ]);

    const handlers = createPostHandlers({
      wallet: () => wallet,
      uploadImage: async () => 'cid',
      createPost: (w, post) => services.posts.createPost(w, post),
      deletePost: (w, id) => services.posts.deletePost(w, id),
      onPublished: (localId, post) => usePostStore.getState().settle(localId, post),
    });
    await handlers.createPost(queued[0]?.payload);

    const posts = Object.values(usePostStore.getState().posts);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.pending).toBeFalsy();
    expect(posts[0]?.text).toBe('hello');
  });
});
