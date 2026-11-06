import { describe, expect, it } from 'vitest';
import {
  buildInbox,
  countUnread,
  groupsPresent,
  type InboxItem,
  inboxGroupOf,
  readAllCutoff,
  unreadByGroup,
} from '@/utils/inbox';

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

type ClubArg = NonNullable<Parameters<typeof buildInbox>[0]['clubs']>[number];

describe('club, event and milestone items', () => {
  const NOW = Date.parse('2026-11-06T12:00:00Z');
  const unix = (iso: string) => Date.parse(iso) / 1000;
  const club = (over: Partial<ClubArg> = {}): ClubArg => ({
    id: '7',
    name: 'Dawn Runners',
    managedByMe: false,
    requests: [],
    posts: [],
    ...over,
  });
  const base = { me: ME, followers: [], activities: [], now: NOW };

  it('lists other members posts in a club, not the athlete’s own', () => {
    const items = buildInbox({
      ...base,
      clubs: [
        club({
          posts: [
            { id: 'p1', author: A, createdAt: unix('2026-11-06T09:00:00Z') },
            { id: 'p2', author: ME, createdAt: unix('2026-11-06T10:00:00Z') },
          ],
        }),
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'club_post',
      actorId: A,
      clubId: '7',
      title: 'Dawn Runners',
    });
  });

  it('shows pending join requests only to the club’s managers', () => {
    const requests = [
      { member: A, status: 'pending', at: unix('2026-11-05T09:00:00Z') },
      { member: B, status: 'declined', at: unix('2026-11-05T09:00:00Z') },
    ];
    expect(buildInbox({ ...base, clubs: [club({ requests })] })).toHaveLength(0);
    const managed = buildInbox({ ...base, clubs: [club({ requests, managedByMe: true })] });
    expect(managed.map((i) => [i.kind, i.actorId])).toEqual([['club_request', A]]);
  });

  it('tells the athlete when their own request was approved', () => {
    const items = buildInbox({
      ...base,
      clubs: [
        club({ requests: [{ member: ME, status: 'approved', at: unix('2026-11-04T09:00:00Z') }] }),
      ],
    });
    expect(items[0]).toMatchObject({ kind: 'club_approved', title: 'Dawn Runners' });
    expect(items[0]?.actorId).toBeUndefined();
  });

  it('hides club items from blocked people', () => {
    const items = buildInbox({
      ...base,
      hidden: new Set([A.toLowerCase()]),
      clubs: [club({ posts: [{ id: 'p1', author: A, createdAt: unix('2026-11-06T09:00:00Z') }] })],
    });
    expect(items).toHaveLength(0);
  });

  it('reminds about a joined event in the day before it starts, until it ends', () => {
    const event = (id: string, startOffsetH: number, hours = 2) => ({
      id,
      title: `Event ${id}`,
      startDate: new Date(NOW + startOffsetH * 3_600_000),
      endDate: new Date(NOW + (startOffsetH + hours) * 3_600_000),
    });
    const items = buildInbox({
      ...base,
      events: [event('soon', 5), event('far', 48), event('now', -1), event('over', -10)],
    });
    expect(items.map((i) => i.eventId).sort()).toEqual(['now', 'soon']);
    const soon = items.find((i) => i.eventId === 'soon');
    expect(soon?.kind).toBe('event_reminder');
    expect(soon?.at.getTime()).toBe(NOW + 5 * 3_600_000 - 24 * 3_600_000);
    expect(soon?.startsAt?.getTime()).toBe(NOW + 5 * 3_600_000);
  });

  it('lists recent badges only', () => {
    const items = buildInbox({
      ...base,
      milestones: [
        { id: 'five_km', title: '5K', at: new Date(NOW - 2 * 86_400_000) },
        { id: 'old', title: 'Old', at: new Date(NOW - 90 * 86_400_000) },
      ],
    });
    expect(items.map((i) => i.title)).toEqual(['5K']);
  });
});

describe('inbox grouping', () => {
  const item = (id: string, kind: InboxItem['kind'], at: number): InboxItem => ({
    id,
    kind,
    at: new Date(at),
  });
  const items = [
    item('a', 'club_post', 5000),
    item('b', 'club_request', 4000),
    item('c', 'kudos', 3000),
    item('d', 'milestone', 1000),
  ];

  it('groups club kinds together and keeps first-seen order', () => {
    expect(groupsPresent(items)).toEqual(['club', 'kudos', 'milestone']);
    expect(inboxGroupOf('club_approved')).toBe('club');
    expect(inboxGroupOf('event_reminder')).toBe('event');
  });

  it('counts unread per group', () => {
    expect(unreadByGroup(items, 2000)).toEqual({ club: 2, kudos: 1 });
    expect(unreadByGroup(items, 9000)).toEqual({});
  });

  it('reads everything up to the newest item and never goes backwards', () => {
    expect(readAllCutoff(items, 0)).toBe(5000);
    expect(readAllCutoff(items, 8000)).toBe(8000);
    expect(readAllCutoff([], 3)).toBe(3);
  });
});
