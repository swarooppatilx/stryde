import { services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { logger } from '@/utils/logger';
import type { PostEntry } from '@/utils/postFeed';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface PostState {
  /** Published posts and ones still being sent, by id. */
  posts: Record<string, PostEntry>;
  /** Shows a post at once; it stays marked pending until `settle` or `drop`. */
  addPending: (post: Omit<PostEntry, 'pending'>) => void;
  /** Replaces a pending post with the one the server published. */
  settle: (localId: string, post: Omit<PostEntry, 'pending'>) => void;
  /** Forgets a post (refused, or deleted by its author). */
  drop: (id: string) => void;
  remove: (id: string) => void;
  /** Adds published posts to the cache. */
  remember: (posts: readonly Omit<PostEntry, 'pending'>[]) => void;
  /** Replaces the cache for these authors with the server's newest posts; keeps what it has if that fails. */
  fetchPosts: (authors: readonly `0x${string}`[]) => Promise<void>;
  /** Every post, newest first. */
  list: () => PostEntry[];
  reset: () => void;
}

/** The server returns at most this many of the newest posts per request. */
const FETCH_LIMIT = 50;

export const usePostStore = create<PostState>()(
  persist(
    (set, get) => ({
      posts: {},

      addPending: (post) =>
        set((state) => ({ posts: { ...state.posts, [post.id]: { ...post, pending: true } } })),

      settle: (localId, post) =>
        set((state) => {
          const { [localId]: _pending, ...rest } = state.posts;
          return { posts: { ...rest, [post.id]: post } };
        }),

      drop: (id) =>
        set((state) => {
          const { [id]: _gone, ...rest } = state.posts;
          return { posts: rest };
        }),

      remove: (id) => get().drop(id),

      remember: (posts) =>
        set((state) => ({
          posts: { ...state.posts, ...Object.fromEntries(posts.map((p) => [p.id, p])) },
        })),

      fetchPosts: async (authors) => {
        if (authors.length === 0) return;
        // What was cached when the request left: anything that appears later (a post delivered while
        // the list was loading) is newer than the answer and must survive it.
        const cachedBefore = new Set(Object.keys(get().posts));
        try {
          const fetched = await services.posts.getPosts(authors, FETCH_LIMIT);
          const queried = new Set(authors.map((a) => a.toLowerCase()));
          set((state) => {
            const kept = Object.fromEntries(
              Object.entries(state.posts).filter(
                ([id, post]) =>
                  post.pending || !queried.has(post.author.toLowerCase()) || !cachedBefore.has(id)
              )
            );
            return { posts: { ...kept, ...Object.fromEntries(fetched.map((p) => [p.id, p])) } };
          });
        } catch (e) {
          logger.warn('[Posts] Failed to load posts:', e);
        }
      },

      list: () => Object.values(get().posts).sort((a, b) => b.createdAt - a.createdAt),

      reset: () => set({ posts: {} }),
    }),
    {
      name: '@stryde/posts',
      version: 1,
      migrate: (persisted) => persisted,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
