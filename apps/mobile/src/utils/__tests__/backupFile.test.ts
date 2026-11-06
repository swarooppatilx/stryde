import { describe, expect, it } from 'vitest';
import type { Activity, Gear } from '@/types';
import {
  BACKUP_VERSION,
  buildBackup,
  mergeBackup,
  parseBackup,
  restoreSummary,
} from '@/utils/backupFile';
import type { Goal } from '@/utils/goals';
import { DEFAULT_SETTINGS } from '@/utils/profile';

const base = {
  userId: '0xme',
  activityType: 'run',
  distance: 5000,
  duration: 1_500_000,
  polyline: 'abc',
  territory: null,
  territoryArea: 0,
  createdAt: new Date('2026-10-20T06:00:00Z'),
};
const priv = {
  ...base,
  id: 'p1',
  privacy: 'only_me',
  privateNote: 'tight calf',
  images: ['file:///data/local.jpg', 'https://gw.example/ipfs/x'],
  sync: { attempts: 2, nextAttemptAt: 5 },
} as Activity;
const pub = { ...base, id: 'u1', privacy: 'everyone', privateNote: 'felt great' } as Activity;
const gear: Gear[] = [{ id: 'g1', name: 'Daily trainers', kind: 'shoes', startingDistance: 0 }];
const goals: Goal[] = [{ id: 'goal1', metric: 'distance', period: 'week', target: 20000 }];
const now = new Date('2026-11-01T10:00:00Z');
const settings = { ...DEFAULT_SETTINGS, units: 'imperial' as const, weightKg: 62 };

const make = () =>
  parseBackup(buildBackup({ activities: [priv, pub], gear, goals, settings, now }));

describe('buildBackup and parseBackup', () => {
  it('round trips what only this phone holds', () => {
    const parsed = make();

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.backup.gear).toEqual(gear);
    expect(parsed.backup.goals).toEqual(goals);
    expect(parsed.backup.settings).toMatchObject({ units: 'imperial', weightKg: 62 });
    expect(parsed.backup.activities.map((a) => a.id)).toEqual(['p1']);
    expect(parsed.backup.activities[0]?.createdAt).toEqual(base.createdAt);
  });

  it('keeps only published photo references and drops sync bookkeeping', () => {
    const parsed = make();
    if (!parsed.ok) throw new Error('expected a backup');

    expect(parsed.backup.activities[0]?.images).toEqual(['https://gw.example/ipfs/x']);
    expect(parsed.backup.activities[0]).not.toHaveProperty('sync');
  });

  it('keeps private notes of public activities by id, not the activities', () => {
    const parsed = make();
    if (!parsed.ok) throw new Error('expected a backup');

    expect(parsed.backup.notes).toEqual({ u1: 'felt great' });
  });

  it('refuses a file made by a newer version', () => {
    const newer = JSON.stringify({
      ...JSON.parse(buildBackup({ activities: [], gear: [], goals: [], settings, now })),
      version: BACKUP_VERSION + 1,
    });

    expect(parseBackup(newer)).toEqual({ ok: false, reason: 'newer_version' });
  });

  it.each([
    ['not json', '{oops'],
    ['not an object', '[]'],
    ['another kind of file', JSON.stringify({ version: 1, athlete: {} })],
  ])('refuses %s', (_label, text) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
  });

  it('refuses a file whose activity is damaged', () => {
    const file = JSON.parse(buildBackup({ activities: [priv], gear, goals, settings, now }));
    file.activities[0].distance = 'far';

    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: false, reason: 'corrupted' });
  });

  it('refuses a file whose gear or goal is damaged', () => {
    const file = JSON.parse(buildBackup({ activities: [], gear, goals, settings, now }));
    file.goals[0].metric = 'vibes';

    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: false, reason: 'corrupted' });
  });
});

describe('mergeBackup', () => {
  const backup = (() => {
    const parsed = make();
    if (!parsed.ok) throw new Error('expected a backup');
    return parsed.backup;
  })();
  const empty = { activities: [], gear: [], goals: [], settings: DEFAULT_SETTINGS };

  it('brings everything back into an empty phone', () => {
    const merged = mergeBackup(backup, empty, '0xnew');

    expect(merged.activities.map((a) => a.id)).toEqual(['p1']);
    expect(merged.activities[0]?.userId).toBe('0xnew');
    expect(merged.gear).toEqual(gear);
    expect(merged.goals).toEqual(goals);
    expect(merged.settings).toMatchObject({ units: 'imperial', weightKg: 62 });
    expect(merged.counts).toEqual({ activities: 1, gear: 1, goals: 1, notes: 0, settings: true });
  });

  it('never overwrites an item the phone already has', () => {
    const local = { ...priv, name: 'Edited here' } as Activity;
    const localGear = [{ ...gear[0], name: 'Renamed' }] as Gear[];
    const merged = mergeBackup(
      backup,
      {
        activities: [local],
        gear: localGear,
        goals: [{ ...goals[0], target: 1 } as Goal],
        settings: DEFAULT_SETTINGS,
      },
      '0xme'
    );

    expect(merged.activities).toEqual([]);
    expect(merged.gear).toEqual([]);
    expect(merged.goals).toEqual([]);
  });

  it('leaves a setting alone once it was changed on this phone', () => {
    const merged = mergeBackup(
      backup,
      { ...empty, settings: { ...DEFAULT_SETTINGS, units: 'metric', weightKg: 80 } },
      '0xme'
    );

    expect(merged.settings).toEqual({ units: 'imperial' });
  });

  it('restores a note only onto an activity that has none', () => {
    const noteless = { ...pub, privateNote: undefined } as Activity;
    const withNote = { ...pub, privateNote: 'newer words' } as Activity;

    expect(mergeBackup(backup, { ...empty, activities: [noteless] }, '0xme').notes).toEqual({
      u1: 'felt great',
    });
    expect(mergeBackup(backup, { ...empty, activities: [withNote] }, '0xme').notes).toEqual({});
    expect(mergeBackup(backup, empty, '0xme').notes).toEqual({});
  });
});

describe('restoreSummary', () => {
  it('says what is added and that the phone keeps what it has', () => {
    expect(restoreSummary({ activities: 2, gear: 0, goals: 1, notes: 0, settings: true })).toBe(
      'This adds 2 activities, 1 goal, your settings. Anything already on this phone is kept as it is.'
    );
  });

  it('says plainly when nothing would change', () => {
    expect(restoreSummary({ activities: 0, gear: 0, goals: 0, notes: 0, settings: false })).toMatch(
      /Nothing changes/
    );
  });
});
