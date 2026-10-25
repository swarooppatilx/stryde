import { describe, expect, it } from 'vitest';
import { buildInbox, countUnread } from '@/utils/inbox';

const ME = '0xaaaa000000000000000000000000000000000001';
const A = '0xbbbb000000000000000000000000000000000002';
const B = '0xcccc000000000000000000000000000000000003';

const comment = (id: string, userId: string, at: string) => ({
  id,
  userId,
  text: `text ${id}`,
  createdAt: new Date(at),
  likedBy: [],
});

describe('buildInbox', () => {
  it('lists new followers and comments from others, newest first', () => {
    const items = buildInbox({
      me: ME,
      followers: [{ address: A, followedAt: 1_700_000_100 }],
      activities: [
        { id: 'run1', userId: ME, comments: [comment('c1', B, '2023-11-14T22:20:00Z')] },
      ],
    });

    expect(items.map((i) => i.kind)).toEqual(['comment', 'follow']);
    expect(items[0]).toMatchObject({ actorId: B, activityId: 'run1', text: 'text c1' });
    expect(items[1]).toMatchObject({ actorId: A });
  });

  it("ignores my own comments and comments on other people's activities", () => {
    const items = buildInbox({
      me: ME,
      followers: [],
      activities: [
        { id: 'mine', userId: ME, comments: [comment('c1', ME, '2024-01-01T00:00:00Z')] },
        { id: 'theirs', userId: A, comments: [comment('c2', B, '2024-01-01T00:00:00Z')] },
      ],
    });

    expect(items).toEqual([]);
  });

  it('skips follows without a recorded time because they cannot be ordered or marked unread', () => {
    expect(
      buildInbox({ me: ME, followers: [{ address: A, followedAt: 0 }], activities: [] })
    ).toEqual([]);
  });
});

describe('buildInbox kudos', () => {
  const run = (kudos: string[], kudosAt?: Record<string, number>, userId = ME) => ({
    id: 'run1',
    userId,
    comments: [],
    kudos,
    kudosAt,
  });

  it('lists kudos on my activities with their time, merged newest first with follows', () => {
    const items = buildInbox({
      me: ME,
      followers: [{ address: B, followedAt: 1_700_000_200 }],
      activities: [run([A], { [A]: 1_700_000_300 })],
    });

    expect(items.map((i) => i.kind)).toEqual(['kudos', 'follow']);
    expect(items[0]).toMatchObject({ actorId: A, activityId: 'run1' });
    expect(items[0]?.at).toEqual(new Date(1_700_000_300_000));
  });

  it('skips kudos with no timestamp, my own, on other activities, and from hidden athletes', () => {
    const items = buildInbox({
      me: ME,
      followers: [],
      hidden: new Set([B.toLowerCase()]),
      activities: [
        run([A]),
        run([ME, B], { [ME]: 1_700_000_100, [B]: 1_700_000_100 }),
        run([A], { [A]: 1_700_000_100 }, B),
      ],
    });

    expect(items).toEqual([]);
  });

  it('matches givers case-insensitively', () => {
    const items = buildInbox({
      me: ME,
      followers: [],
      activities: [run([A.toUpperCase().replace('0X', '0x')], { [A]: 1_700_000_100 })],
    });

    expect(items).toHaveLength(1);
  });
});

describe('countUnread', () => {
  it('counts only items newer than the last time the inbox was opened', () => {
    const items = buildInbox({
      me: ME,
      followers: [
        { address: A, followedAt: 1_700_000_100 },
        { address: B, followedAt: 1_700_000_900 },
      ],
      activities: [],
    });

    expect(countUnread(items, 1_700_000_500_000)).toBe(1);
    expect(countUnread(items, 0)).toBe(2);
  });
});

describe('buildInbox with blocked athletes', () => {
  it('leaves out followers and commenters the athlete has hidden', () => {
    const items = buildInbox({
      me: ME,
      followers: [
        { address: A, followedAt: 1_700_000_100 },
        { address: B, followedAt: 1_700_000_200 },
      ],
      activities: [
        { id: 'run1', userId: ME, comments: [comment('c1', A, '2023-11-14T22:20:00Z')] },
      ],
      hidden: new Set([A.toLowerCase()]),
    });

    expect(items.map((i) => i.actorId)).toEqual([B]);
  });
});
