import { describe, expect, it } from 'vitest';
import { type ActivityRow, formatDuration, timeAgo, toPosts } from './feed';

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const sec = (offsetMs: number) => Math.floor((NOW - offsetMs) / 1000);

const row = (overrides: Partial<ActivityRow> = {}): ActivityRow => ({
  activityId: '7',
  activityType: 0,
  distance: '5000',
  duration: '1500000',
  territoryArea: '0',
  timestamp: String(sec(2 * 3_600_000)),
  metadataCid: null,
  user: { id: '0x1234567890abcdef1234567890abcdef12345678', username: 'asha_runs' },
  kudos: [{ id: 'k1' }, { id: 'k2' }],
  comments: [{ id: 'c1' }],
  ...overrides,
});

describe('timeAgo', () => {
  it('speaks in the largest sensible unit', () => {
    expect(timeAgo(sec(30_000), NOW)).toBe('just now');
    expect(timeAgo(sec(5 * 60_000), NOW)).toBe('5m ago');
    expect(timeAgo(sec(3 * 3_600_000), NOW)).toBe('3h ago');
    expect(timeAgo(sec(2 * 86_400_000), NOW)).toBe('2d ago');
  });
});

describe('formatDuration', () => {
  it('shows minutes and seconds, adding hours past an hour', () => {
    expect(formatDuration(1_500_000)).toBe('25m 00s');
    expect(formatDuration(3_840_000)).toBe('1h 04m');
    expect(formatDuration(45_000)).toBe('0m 45s');
  });
});

describe('toPosts', () => {
  it('turns an activity into a card: name, stats, pace and engagement counts', () => {
    const [post] = toPosts([row()], new Map([['cid', 'x']]), NOW);

    expect(post).toMatchObject({
      athleteName: 'asha_runs',
      athleteInitials: 'AS',
      timeAgo: '2h ago',
      title: 'Run',
      distance: '5.00 km',
      duration: '25m 00s',
      pace: '5:00 /km',
      kudosCount: 2,
      commentsCount: 1,
    });
  });

  it('uses the athlete-given name when the metadata could be read', () => {
    const [post] = toPosts([row({ metadataCid: 'cid1' })], new Map([['cid1', 'Morning 5K']]), NOW);

    expect(post?.title).toBe('Morning 5K');
  });

  it('reports a ride as speed, like the app', () => {
    const [post] = toPosts(
      [row({ activityType: 1, distance: '20000', duration: '3600000' })],
      new Map(),
      NOW
    );

    expect(post).toMatchObject({ title: 'Ride', pace: '20.0 km/h' });
  });

  it('shows territory only when some was claimed', () => {
    const [plain, claimed] = toPosts([row(), row({ territoryArea: '34800' })], new Map(), NOW);

    expect(plain?.territoryClaimed).toBeNull();
    expect(claimed?.territoryClaimed).toBe('+34,800 m² claimed');
  });

  it('falls back to a short address for an athlete with no name', () => {
    const [post] = toPosts(
      [row({ user: { id: '0x1234567890abcdef1234567890abcdef12345678', username: '' } })],
      new Map(),
      NOW
    );

    expect(post?.athleteName).toBe('0x1234…5678');
    expect(post?.athleteInitials).toBe('0X');
  });

  it('copes with an activity that has no distance', () => {
    const [post] = toPosts([row({ distance: '0' })], new Map(), NOW);

    expect(post?.pace).toBe('—');
  });
});
