import { describe, expect, it } from 'vitest';
import { FOLLOW_INTENT_TTL_SECONDS, followTypedData, newFollowIntent } from '../followIntent';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;

describe('newFollowIntent', () => {
  it('expires a couple of minutes from now', () => {
    const intent = newFollowIntent({ follower: ME, followee: THEM, action: 'follow' }, 1_000_000);

    expect(intent).toEqual({
      follower: ME,
      followee: THEM,
      action: 'follow',
      deadline: 1_000_000 + FOLLOW_INTENT_TTL_SECONDS,
    });
  });
});

describe('followTypedData', () => {
  it('describes one Follow message bound to a chain', () => {
    const intent = newFollowIntent({ follower: ME, followee: THEM, action: 'unfollow' }, 10);

    const typed = followTypedData(intent, 11155111);

    expect(typed.primaryType).toBe('Follow');
    expect(typed.domain).toEqual({ name: 'Stryde Social', version: '1', chainId: 11155111 });
    expect(typed.message).toEqual({ ...intent, deadline: BigInt(intent.deadline) });
  });

  it('lists the signed fields in a fixed order, so app and API always agree', () => {
    const typed = followTypedData(
      newFollowIntent({ follower: ME, followee: THEM, action: 'follow' }, 0),
      1
    );

    expect(typed.types.Follow.map((field) => field.name)).toEqual([
      'follower',
      'followee',
      'action',
      'deadline',
    ]);
  });
});
