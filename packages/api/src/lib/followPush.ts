import type { Address } from 'viem';

/** The push for a new follower. `id` is what the app opens on tap (`routeForPush` returns nothing without it). */
export function followPushMessage(follower: Address) {
  return {
    title: 'New follower',
    body: 'Someone started following you',
    data: { kind: 'newFollower', id: follower },
  };
}
