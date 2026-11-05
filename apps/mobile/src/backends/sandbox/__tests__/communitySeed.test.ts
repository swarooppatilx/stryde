import { describe, expect, it } from 'vitest';
import { buildCommunitySeed, mergeCommunitySeed } from '@/backends/sandbox/communitySeed';

const NOW = 1_800_000_000_000;

describe('buildCommunitySeed', () => {
  it('gives the same output for the same time', () => {
    expect(buildCommunitySeed(NOW)).toEqual(buildCommunitySeed(NOW));
  });

  it('has an event that is running now and one still to come', () => {
    const { events } = buildCommunitySeed(NOW);
    const [event] = events;
    expect(events.some((e) => e.startDate.getTime() > NOW)).toBe(true);
    expect(event?.startDate.getTime()).toBeLessThan(NOW);
    expect(event?.endDate.getTime()).toBeGreaterThan(NOW);
  });

  it('gives every club and event its own id', () => {
    const { clubs, events } = buildCommunitySeed(NOW);
    const ids = [...clubs.map((c) => c.id), ...events.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mergeCommunitySeed', () => {
  const seed = buildCommunitySeed(NOW);

  it('fills empty lists', () => {
    expect(mergeCommunitySeed({ clubs: [], events: [] }, seed)).toEqual(seed);
  });

  it('keeps rows already there as they are and adds only the ones missing', () => {
    const [first] = seed.clubs;
    const mine = first ? [{ ...first, name: 'Mine' }] : [];
    const merged = mergeCommunitySeed({ clubs: mine, events: [] }, seed);

    expect(merged.clubs[0]?.name).toBe('Mine');
    expect(merged.clubs).toHaveLength(seed.clubs.length);
    expect(merged.events).toEqual(seed.events);
  });
});
