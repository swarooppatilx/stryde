import { DELIVERY_COPY } from '@/constants/copy';
import { sameAddress } from './address';
import type { DeliveryState } from './deliveryState';
import { ipfsToHttpUrl } from './ipfsUrl';
import type { FeedScope } from './socialFeed';

export interface PostEntry {
  id: string;
  author: string;
  text: string;
  /** IPFS content ids (published posts) or paths on this device (a post still being sent). */
  photos: string[];
  /** Unix seconds. */
  createdAt: number;
  /** True until the server has accepted it. */
  pending?: boolean;
}

/** Narrows posts to everyone, the athletes you follow (and you), or just you: the same tabs as the activity feed. */
export function postsForScope(
  posts: readonly PostEntry[],
  scope: FeedScope,
  viewerId: string,
  following: ReadonlySet<string>
): PostEntry[] {
  switch (scope) {
    case 'Everyone':
      return [...posts];
    case 'Following':
      return posts.filter(
        (p) => sameAddress(p.author, viewerId) || following.has(p.author.toLowerCase())
      );
    case 'You':
      return posts.filter((p) => sameAddress(p.author, viewerId));
  }
}

/** Two lists, each already newest first, merged into one newest first. On a tie the first list goes first. */
export function mergeByTime<A, B>(
  first: readonly A[],
  second: readonly B[],
  time: (item: A | B) => number
): (A | B)[] {
  const merged: (A | B)[] = [];
  let i = 0;
  let j = 0;
  while (i < first.length && j < second.length) {
    const a = first[i] as A;
    const b = second[j] as B;
    if (time(a) >= time(b)) {
      merged.push(a);
      i++;
    } else {
      merged.push(b);
      j++;
    }
  }
  return merged.concat(first.slice(i), second.slice(j));
}

/** A post photo as an image can load it: a content id goes through the gateway, a path on this device stays. */
export function postPhotoUri(photo: string): string {
  return /^(file|content|https?):/.test(photo) ? photo : ipfsToHttpUrl(photo);
}

/** The social API reads at most this many authors per request. */
const MAX_AUTHORS = 100;

/** Whose posts to ask the server for: you, then who you follow, then other known athletes. */
export function postAuthors(
  viewerId: string,
  following: ReadonlySet<string>,
  knownAthletes: readonly string[]
): string[] {
  const ordered = [viewerId, ...following, ...knownAthletes].map((a) => a.toLowerCase());
  return [...new Set(ordered)].slice(0, MAX_AUTHORS);
}

/** One author's posts, newest first. */
export function postsBy(posts: readonly PostEntry[], author: string): PostEntry[] {
  return posts
    .filter((p) => sameAddress(p.author, author))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Posts still marked as sending that have no entry in the outbox: nothing will ever send them. */
export function orphanedPosts(
  posts: readonly PostEntry[],
  entries: readonly { key?: string }[]
): PostEntry[] {
  const queued = new Set(entries.map((e) => e.key));
  return posts.filter((p) => p.pending && !queued.has(`post:${p.id}`));
}

/** The line under an author's name: when a sent post was written, or where a waiting one stands. */
export function postStatusLine(
  post: PostEntry,
  delivery: DeliveryState | undefined,
  when: string
): { text: string; failed: boolean } {
  if (!post.pending) return { text: when, failed: false };
  if (delivery === 'failed') return { text: "Couldn't send", failed: true };
  if (delivery === 'waiting-for-network' || delivery === 'stuck') {
    return { text: DELIVERY_COPY[delivery], failed: false };
  }
  return { text: DELIVERY_COPY.sending, failed: false };
}
