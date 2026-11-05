import { describe, expect, it } from 'vitest';
import { PERSONAS } from '@/backends/auth/personas';
import { buildSeed, mergeSeed } from '@/backends/sandbox/seed';

const NOW = new Date('2026-10-20T08:00:00Z').getTime();

describe('buildSeed', () => {
  const seed = buildSeed(NOW);

  it('creates several athletes with lowercase addresses as ids', () => {
    expect(seed.users.length).toBeGreaterThanOrEqual(3);
    for (const user of seed.users) {
      expect(user.id).toBe(user.id.toLowerCase());
      expect(user.wallet.toLowerCase()).toBe(user.id);
      expect(user.username.length).toBeGreaterThan(1);
    }
    expect(new Set(seed.users.map((u) => u.id)).size).toBe(seed.users.length);
  });

  it('shares no username or name with a developer persona, so the feed never shows a second you', () => {
    const personas = PERSONAS.flatMap((p) => (p.profile ? [p.profile] : []));
    for (const user of seed.users) {
      expect(personas.map((p) => p.username)).not.toContain(user.username);
      expect(personas.map((p) => `${p.firstName} ${p.lastName}`)).not.toContain(
        `${user.firstName} ${user.lastName}`
      );
    }
  });

  it('gives every activity an athlete in the seed, a route, and a past date', () => {
    const ids = new Set(seed.users.map((u) => u.id));
    for (const activity of seed.activities) {
      expect(ids.has(activity.userId)).toBe(true);
      expect(activity.polyline.split(';').length).toBeGreaterThan(5);
      expect(activity.createdAt.getTime()).toBeLessThan(NOW);
      expect(activity.distance).toBeGreaterThan(0);
    }
  });

  it('lists activities with unique ids, already on-chain so kudos and comments can be sent', () => {
    expect(new Set(seed.activities.map((a) => a.id)).size).toBe(seed.activities.length);
    for (const activity of seed.activities) {
      expect(activity.activityId).toBeDefined();
      expect(activity.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it('includes a post with a comment and one with kudos, so those parts of the feed are not empty', () => {
    expect(seed.activities.some((a) => a.comments.length > 0)).toBe(true);
    expect(seed.activities.some((a) => a.kudos.length > 0)).toBe(true);
  });

  it('is the same every time for the same moment', () => {
    expect(buildSeed(NOW)).toEqual(seed);
  });
});

describe('mergeSeed', () => {
  const seed = buildSeed(NOW);

  it('adds seeded athletes and activities that are missing', () => {
    const merged = mergeSeed({ users: {}, activities: {} }, seed);
    expect(Object.keys(merged.users)).toHaveLength(seed.users.length);
    expect(Object.keys(merged.activities)).toHaveLength(seed.activities.length);
  });

  it('never overwrites what is already there, so local kudos and comments survive a relaunch', () => {
    const first = seed.activities[0];
    const user = seed.users[0];
    if (!first || !user) throw new Error('seed is empty');
    const edited = { ...first, kudos: [...first.kudos, '0xme'] };
    const merged = mergeSeed(
      {
        users: { [user.id]: { ...user, followers: 99 } },
        activities: { [first.id.toLowerCase()]: edited },
      },
      seed
    );

    expect(merged.activities[first.id.toLowerCase()]?.kudos).toContain('0xme');
    expect(merged.users[user.id]?.followers).toBe(99);
  });

  it('includes a post with several photos and one with a single photo, to try the photo views', () => {
    const counts = seed.activities.map((a) => a.images?.length ?? 0);

    expect(counts.some((n) => n >= 3)).toBe(true);
    expect(counts.some((n) => n === 1)).toBe(true);
  });
});
