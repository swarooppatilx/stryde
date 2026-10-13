import { describe, expect, it, vi } from 'vitest';
import { FakeHealthSource } from '@/platform/fakes';
import type { HealthWorkout } from '@/platform/ports';
import {
  activityInputFromWorkout,
  FIRST_IMPORT_DAYS,
  type HealthImportState,
  importWorkouts,
  MAX_REMEMBERED_IDS,
  overlapsOwnActivity,
} from '@/services/healthImport';

const NOW = new Date('2026-10-20T08:00:00Z').getTime();
const DAY = 86_400_000;

const workout = (id: string, daysAgo: number): HealthWorkout => ({
  id,
  sport: 'run',
  startTime: NOW - daysAgo * DAY,
  endTime: NOW - daysAgo * DAY + 1_800_000,
  distanceM: 5000,
});

function setup(
  workouts: HealthWorkout[],
  state: HealthImportState = { watermark: null, imported: [] }
) {
  const health = new FakeHealthSource();
  health.access = true;
  health.workouts = workouts;
  let current = state;
  const save = vi.fn(async (_: HealthWorkout) => {});
  const own: Array<{ createdAt: Date | number; duration: number }> = [];
  const deps = {
    health,
    state: { read: () => current, write: (next: HealthImportState) => (current = next) },
    save,
    now: () => NOW,
    existing: () => own,
  };
  return { deps, health, save, own, state: () => current };
}

describe('importWorkouts', () => {
  it('does nothing when health data is not available on this phone', async () => {
    const { deps, health, save } = setup([workout('a', 1)]);
    health.currentStatus = 'unavailable';

    expect(await importWorkouts(deps)).toEqual({ status: 'unavailable' });
    expect(save).not.toHaveBeenCalled();
    expect(health.readsSince).toEqual([]);
  });

  it('says when the provider needs updating', async () => {
    const { deps, health } = setup([]);
    health.currentStatus = 'update-required';
    expect(await importWorkouts(deps)).toEqual({ status: 'update-required' });
  });

  it('does not read anything without access', async () => {
    const { deps, health, save } = setup([workout('a', 1)]);
    health.access = false;

    expect(await importWorkouts(deps)).toEqual({ status: 'no-access' });
    expect(save).not.toHaveBeenCalled();
  });

  it('on the first import looks back a fixed number of days, oldest first', async () => {
    const { deps, health, save } = setup([
      workout('new', 1),
      workout('old', 5),
      workout('ancient', 90),
    ]);

    const result = await importWorkouts(deps);

    expect(health.readsSince).toEqual([NOW - FIRST_IMPORT_DAYS * DAY]);
    expect(result).toEqual({ status: 'done', imported: 2, skipped: 0, failed: 0 });
    expect(save.mock.calls.map(([w]) => w.id)).toEqual(['old', 'new']);
  });

  it('remembers what it imported and moves on to the newest workout', async () => {
    const { deps, state } = setup([workout('a', 5), workout('b', 1)]);

    await importWorkouts(deps);

    expect(state().imported).toEqual(['a', 'b']);
    expect(state().watermark).toBe(NOW - 1 * DAY);
  });

  it('later imports start from where the last one ended and never repeat a workout', async () => {
    const { deps, health, save } = setup([workout('a', 5), workout('b', 1)], {
      watermark: NOW - 5 * DAY - 1,
      imported: ['a'],
    });

    const result = await importWorkouts(deps);

    expect(health.readsSince).toEqual([NOW - 5 * DAY - 1]);
    expect(result).toEqual({ status: 'done', imported: 1, skipped: 1, failed: 0 });
    expect(save.mock.calls.map(([w]) => w.id)).toEqual(['b']);
  });

  it('imports the rest when one fails, keeps the watermark back, and gets the failed one next time', async () => {
    const { deps, save, state } = setup([workout('a', 5), workout('b', 3), workout('c', 1)]);
    save.mockRejectedValueOnce(new Error('disk full'));

    const first = await importWorkouts(deps);

    expect(first).toEqual({ status: 'done', imported: 2, skipped: 0, failed: 1 });
    expect(state().watermark).toBeNull();
    expect(state().imported).toEqual(['b', 'c']);

    const second = await importWorkouts(deps);

    expect(second).toEqual({ status: 'done', imported: 1, skipped: 2, failed: 0 });
    expect(state().imported).toEqual(['b', 'c', 'a']);
    expect(state().watermark).toBe(NOW - 1 * DAY);
  });

  it('keeps only the most recent ids it has seen', async () => {
    const many = Array.from({ length: MAX_REMEMBERED_IDS + 5 }, (_, i) => workout(`w${i}`, 1));
    const { deps, state } = setup(many.map((w, i) => ({ ...w, startTime: NOW - 10 * DAY + i })));

    await importWorkouts(deps);

    expect(state().imported).toHaveLength(MAX_REMEMBERED_IDS);
    expect(state().imported.at(-1)).toBe(`w${MAX_REMEMBERED_IDS + 4}`);
  });
});

describe('activityInputFromWorkout', () => {
  const START = NOW - DAY;
  const route = Array.from({ length: 30 }, (_, i) => ({
    latitude: 18.52 + i * 0.0003,
    longitude: 73.85,
    altitude: 560 + i,
    timestamp: START + 5000 + i * 10_000,
  }));
  const heartRate = {
    avg: 150,
    max: 171,
    series: { t: [0, 100, 200], bpm: [120, 150, 171] },
  };

  it('keeps a plain workout as a manual-style entry with no route', () => {
    const input = activityInputFromWorkout(workout('a', 1));
    expect(input).toMatchObject({
      activityType: 'run',
      distance: 5000,
      duration: 1_800_000,
      polyline: '',
      isManual: true,
      startedAt: START,
    });
    expect(input.stream).toBeUndefined();
    expect(input.heartRate).toBeUndefined();
  });

  it('carries heart rate and device calories onto the activity', () => {
    const input = activityInputFromWorkout({ ...workout('a', 1), heartRate, calories: 412 });
    expect(input.heartRate).toEqual({ avg: 150, max: 171 });
    expect(input.caloriesBurned).toBe(412);
  });

  it('builds the polyline, stream and climb from a route', () => {
    const input = activityInputFromWorkout({ ...workout('a', 1), route });
    expect(input.polyline).not.toBe('');
    expect(input.stream?.d?.length).toBeGreaterThan(1);
    expect(input.elevationGain).toBeGreaterThan(0);
  });

  it('measures the distance from the route when the workout reported none', () => {
    const input = activityInputFromWorkout({ ...workout('a', 1), distanceM: 0, route });
    expect(input.distance).toBeGreaterThan(500);
  });

  it('lines heart rate up with the first fix of the stream', () => {
    const input = activityInputFromWorkout({ ...workout('a', 1), route, heartRate });
    // The first fix is 5 s after the workout began, so a reading at 0 s falls before the stream.
    expect(input.stream?.heartRate?.t).toEqual([95, 195]);
    expect(input.stream?.heartRate?.bpm).toEqual([150, 171]);
  });
});

describe('a workout that is the same run as one already on this phone', () => {
  const run = workout('watch-copy', 1);

  it('is not imported a second time, and is remembered so it is not looked at again', async () => {
    const { deps, save, own, state } = setup([run]);
    // Recorded here at the same time, dated by when it started.
    own.push({ createdAt: run.startTime + 30_000, duration: 1_780_000 });

    const result = await importWorkouts(deps);

    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'done', imported: 0, skipped: 1, failed: 0 });
    expect(state().imported).toContain('watch-copy');
  });

  it('still imports one that merely happened the same day', async () => {
    const { deps, save, own } = setup([run]);
    own.push({ createdAt: run.startTime + 6 * 3_600_000, duration: 1_800_000 });

    await importWorkouts(deps);

    expect(save).toHaveBeenCalledOnce();
  });
});

describe('overlapsOwnActivity', () => {
  const w = workout('w', 1); // 30 minutes
  const at = (offsetMin: number, durationMin: number) => ({
    createdAt: w.startTime + offsetMin * 60_000,
    duration: durationMin * 60_000,
  });

  it('is true when most of the workout was already recorded here', () => {
    expect(overlapsOwnActivity(w, [at(1, 29)])).toBe(true);
  });

  it('also reads an older activity, dated by when it was saved at the end', () => {
    // Saved at the end of the same half hour: its start is the end minus its length.
    expect(overlapsOwnActivity(w, [{ createdAt: w.endTime + 20_000, duration: 1_790_000 }])).toBe(
      true
    );
  });

  it('is false for a different time', () => {
    expect(overlapsOwnActivity(w, [at(120, 30)])).toBe(false);
    expect(overlapsOwnActivity(w, [at(-120, 30)])).toBe(false);
  });

  it('is false with nothing recorded here', () => {
    expect(overlapsOwnActivity(w, [])).toBe(false);
  });
});
