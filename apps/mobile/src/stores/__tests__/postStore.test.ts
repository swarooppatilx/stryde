import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

const getPosts = vi.hoisted(() => vi.fn());

vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: { ...actual.services, posts: { ...actual.services.posts, getPosts } },
  };
});

installFakePlatform();
const { usePostStore } = await import('@/stores/postStore');

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const published = (id: string, author: string, createdAt: number) => ({
  id,
  author,
  text: id,
  photos: [],
  createdAt,
});

beforeEach(() => {
  installFakePlatform();
  usePostStore.getState().reset();
  getPosts.mockReset();
});

describe('post store', () => {
  it('shows a post at once, marked pending, until the server has it', () => {
    usePostStore.getState().addPending({
      id: 'local:1',
      author: A,
      text: 'hi',
      photos: ['file:///a.jpg'],
      createdAt: 5,
    });

    expect(usePostStore.getState().posts['local:1']).toMatchObject({ text: 'hi', pending: true });
  });

  it('swaps a pending post for the published one', () => {
    const { addPending, settle } = usePostStore.getState();
    addPending({ id: 'local:1', author: A, text: 'hi', photos: [], createdAt: 5 });

    settle('local:1', published('server-1', A, 6));

    const { posts } = usePostStore.getState();
    expect(posts['local:1']).toBeUndefined();
    expect(posts['server-1']).toMatchObject({ createdAt: 6 });
    expect(posts['server-1']?.pending).toBeFalsy();
  });

  it('drops a post the server refused', () => {
    const { addPending, drop } = usePostStore.getState();
    addPending({ id: 'local:1', author: A, text: 'hi', photos: [], createdAt: 5 });

    drop('local:1');

    expect(usePostStore.getState().posts).toEqual({});
  });

  it('loads the authors’ posts and keeps pending ones and other authors’ posts', async () => {
    const { addPending, remember } = usePostStore.getState();
    addPending({ id: 'local:1', author: A, text: 'waiting', photos: [], createdAt: 9 });
    remember([published('other', B, 1)]);
    getPosts.mockResolvedValue([published('fresh', A, 8)]);

    await usePostStore.getState().fetchPosts([A as `0x${string}`]);

    expect(Object.keys(usePostStore.getState().posts).sort()).toEqual([
      'fresh',
      'local:1',
      'other',
    ]);
  });

  it('forgets a post that is no longer on the server (the author deleted it)', async () => {
    usePostStore.getState().remember([published('gone', A, 1), published('kept', A, 2)]);
    getPosts.mockResolvedValue([published('kept', A, 2)]);

    await usePostStore.getState().fetchPosts([A as `0x${string}`]);

    expect(Object.keys(usePostStore.getState().posts)).toEqual(['kept']);
  });

  it('keeps a post that was published while the list was still loading', async () => {
    const { addPending, settle, fetchPosts } = usePostStore.getState();
    addPending({ id: 'local:1', author: A, text: 'mine', photos: [], createdAt: 5 });
    let answer: (posts: ReturnType<typeof published>[]) => void = () => {};
    getPosts.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const loading = fetchPosts([A as `0x${string}`]);
    // The post is delivered while the request is out, then the (older) answer arrives without it.
    settle('local:1', published('server-1', A, 6));
    answer([]);
    await loading;

    expect(Object.keys(usePostStore.getState().posts)).toEqual(['server-1']);
  });

  it('keeps what it has when the server cannot be reached', async () => {
    usePostStore.getState().remember([published('kept', A, 2)]);
    getPosts.mockRejectedValue(new Error('offline'));

    await usePostStore.getState().fetchPosts([A as `0x${string}`]);

    expect(Object.keys(usePostStore.getState().posts)).toEqual(['kept']);
  });

  it('removes a post at once when its author deletes it', () => {
    usePostStore.getState().remember([published('p1', A, 1)]);

    usePostStore.getState().remove('p1');

    expect(usePostStore.getState().posts).toEqual({});
  });

  it('lists posts newest first', () => {
    usePostStore.getState().remember([published('old', A, 1), published('new', B, 9)]);

    expect(
      usePostStore
        .getState()
        .list()
        .map((p) => p.id)
    ).toEqual(['new', 'old']);
  });
});
