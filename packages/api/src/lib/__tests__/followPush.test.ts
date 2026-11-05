import { describe, expect, it } from 'vitest';
import { followPushMessage } from '../followPush.js';

describe('followPushMessage', () => {
  it('carries the follower address so a tap can open their profile', () => {
    const follower = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    expect(followPushMessage(follower).data).toEqual({ kind: 'newFollower', id: follower });
  });
});
