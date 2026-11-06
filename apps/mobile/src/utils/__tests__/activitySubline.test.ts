import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { activitySubline } from '@/utils/activitySubline';

const NOW = new Date(2026, 10, 6, 15, 0);
const at = (daysAgo: number) => new Date(2026, 10, 6 - daysAgo, 8, 0).getTime();

const make = (patch: Partial<Activity>): Activity =>
  ({
    id: 'a',
    activityType: 'run',
    distance: 5000,
    duration: 1_500_000,
    createdAt: new Date(at(0)),
    ...patch,
  }) as Activity;

describe('activitySubline', () => {
  it('joins day, distance, time and pace for a run', () => {
    const line = activitySubline(
      make({ stream: { startedAt: at(0) } as Activity['stream'] }),
      'metric',
      NOW
    );
    expect(line).toBe('Today · 5.00km · 25m 0s · 5:00/km');
  });

  it('says Yesterday, then weekday and date', () => {
    expect(activitySubline(make({ createdAt: new Date(at(1)) }), 'metric', NOW)).toMatch(
      /^Yesterday · /
    );
    const older = activitySubline(make({ createdAt: new Date(at(4)) }), 'metric', NOW);
    expect(older).toMatch(/^Mon, Nov 2 · /);
  });

  it('shows a whole-number speed for a ride', () => {
    const line = activitySubline(
      make({ activityType: 'ride', distance: 20_000, duration: 3_600_000 }),
      'metric',
      NOW
    );
    expect(line).toBe('Today · 20.00km · 1h 0m · 20 km/h');
  });

  it('keeps pace for a manual activity that has a distance', () => {
    const line = activitySubline(make({ isManual: true }), 'metric', NOW);
    expect(line).toContain('5:00/km');
  });

  it('omits pace and distance when there is no distance', () => {
    const line = activitySubline(make({ distance: 0, isManual: true }), 'metric', NOW);
    expect(line).toBe('Today · 25m 0s');
  });

  it('omits pace when the duration is zero', () => {
    expect(activitySubline(make({ duration: 0 }), 'metric', NOW)).toBe('Today · 5.00km');
  });
});
