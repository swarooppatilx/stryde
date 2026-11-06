import type { Activity, Gear } from '@/types';
import type { Goal } from '@/utils/goals';
import { DEFAULT_SETTINGS, type ProfileSettings } from '@/utils/profile';

export const BACKUP_VERSION = 1;
const BACKUP_KIND = 'stryde-backup';

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  createdAt: string;
  /** Only Me activities: the ones no public record holds. */
  activities: Activity[];
  /** Private notes of activities that are not Only Me, by activity id. */
  notes: Record<string, string>;
  gear: Gear[];
  goals: Goal[];
  settings: Partial<ProfileSettings>;
}

export type ParsedBackup =
  | { ok: true; backup: Backup }
  | { ok: false; reason: 'corrupted' | 'newer_version' | 'not_a_backup' };

const isRemote = (uri: string) => /^https?:\/\//i.test(uri);

/** Settings that are the athlete's own choices; nothing else rides along. */
const SETTING_KEYS = [
  'units',
  'theme',
  'weeklyGoalDistance',
  'weeklyGoalActivities',
  'weeklyGoalTime',
  'weightKg',
  'heightCm',
  'maxHeartRate',
  'restingHeartRate',
  'hrZoneFloors',
] as const satisfies readonly (keyof ProfileSettings)[];

function pickSettings(settings: ProfileSettings): Partial<ProfileSettings> {
  const picked: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) if (settings[key] !== undefined) picked[key] = settings[key];
  return picked as Partial<ProfileSettings>;
}

function forBackup(activity: Activity): Activity {
  const { sync: _sync, kudos: _kudos, comments: _comments, ...rest } = activity;
  const images = (activity.images ?? []).filter(isRemote);
  return {
    ...rest,
    images,
    image: activity.image && isRemote(activity.image) ? activity.image : undefined,
  };
}

/** The backup file: private-only data, so what is already public is not copied. */
export function buildBackup({
  activities,
  gear,
  goals,
  settings,
  now,
}: {
  activities: readonly Activity[];
  gear: readonly Gear[];
  goals: readonly Goal[];
  settings: ProfileSettings;
  now: Date;
}): string {
  const notes: Record<string, string> = {};
  for (const a of activities)
    if (a.privacy !== 'only_me' && a.privateNote) notes[a.id] = a.privateNote;
  const backup: Backup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    activities: activities.filter((a) => a.privacy === 'only_me').map(forBackup),
    notes,
    gear: [...gear],
    goals: [...goals],
    settings: pickSettings(settings),
  };
  return JSON.stringify(backup, null, 2);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const GOAL_METRICS = ['distance', 'time', 'elevation', 'activities'];
const GOAL_PERIODS = ['week', 'month', 'year'];

function validActivity(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.activityType === 'string' &&
    typeof v.distance === 'number' &&
    typeof v.duration === 'number' &&
    typeof v.polyline === 'string' &&
    typeof v.createdAt === 'string' &&
    !Number.isNaN(Date.parse(v.createdAt))
  );
}

const validGear = (v: unknown) =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  typeof v.name === 'string' &&
  typeof v.kind === 'string' &&
  typeof v.startingDistance === 'number';

const validGoal = (v: unknown) =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  GOAL_METRICS.includes(String(v.metric)) &&
  GOAL_PERIODS.includes(String(v.period)) &&
  typeof v.target === 'number';

function validSettings(v: unknown): v is Partial<ProfileSettings> {
  if (!isRecord(v)) return false;
  for (const [key, value] of Object.entries(v)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) return false;
    if (key === 'units' && value !== 'metric' && value !== 'imperial') return false;
    if (key === 'theme' && value !== 'light' && value !== 'dark' && value !== 'system')
      return false;
    if (key === 'hrZoneFloors') {
      if (!Array.isArray(value) || value.length !== 4 || value.some((n) => typeof n !== 'number'))
        return false;
    } else if (key !== 'units' && key !== 'theme' && typeof value !== 'number') return false;
  }
  return true;
}

/** Reads a backup file's text, checking its version and every part before anything is used. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupted' };
  }
  if (!isRecord(raw) || raw.kind !== BACKUP_KIND || typeof raw.version !== 'number') {
    return { ok: false, reason: 'not_a_backup' };
  }
  if (raw.version > BACKUP_VERSION) return { ok: false, reason: 'newer_version' };
  const { activities, notes, gear, goals, settings } = raw;
  const notesOk = isRecord(notes) && Object.values(notes).every((note) => typeof note === 'string');
  if (
    typeof raw.createdAt !== 'string' ||
    !Array.isArray(activities) ||
    !activities.every(validActivity) ||
    !notesOk ||
    !Array.isArray(gear) ||
    !gear.every(validGear) ||
    !Array.isArray(goals) ||
    !goals.every(validGoal) ||
    !validSettings(settings)
  ) {
    return { ok: false, reason: 'corrupted' };
  }
  return {
    ok: true,
    backup: {
      kind: BACKUP_KIND,
      version: raw.version,
      createdAt: raw.createdAt,
      activities: (activities as Activity[]).map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt as unknown as string),
      })),
      notes: notes as Record<string, string>,
      gear: gear as Gear[],
      goals: goals as Goal[],
      settings,
    },
  };
}

export interface LocalState {
  activities: readonly Activity[];
  gear: readonly Gear[];
  goals: readonly Goal[];
  settings: ProfileSettings;
}

export interface MergeResult {
  activities: Activity[];
  gear: Gear[];
  goals: Goal[];
  settings: Partial<ProfileSettings>;
  /** Private notes to add to existing activities, by activity id. */
  notes: Record<string, string>;
  counts: { activities: number; gear: number; goals: number; notes: number; settings: boolean };
}

/**
 * What a restore adds. The phone always wins: an item with an id it already has is kept as it is, a
 * setting changed from its default is kept, and a note is added only where there is none.
 */
export function mergeBackup(backup: Backup, local: LocalState, userId: string): MergeResult {
  const has = (list: readonly { id: string }[]) => new Set(list.map((item) => item.id));
  const activityIds = has(local.activities);
  const gearIds = has(local.gear);
  const goalIds = has(local.goals);

  const activities = backup.activities
    .filter((a) => !activityIds.has(a.id))
    .map((a) => ({ ...a, userId }));
  const gear = backup.gear.filter((g) => !gearIds.has(g.id));
  const goals = backup.goals.filter((g) => !goalIds.has(g.id));

  const settings: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    const incoming = backup.settings[key];
    if (incoming === undefined) continue;
    const current = local.settings[key];
    const untouched =
      current === undefined || JSON.stringify(current) === JSON.stringify(DEFAULT_SETTINGS[key]);
    if (untouched && JSON.stringify(incoming) !== JSON.stringify(current)) settings[key] = incoming;
  }

  const notes: Record<string, string> = {};
  for (const [id, note] of Object.entries(backup.notes)) {
    const target = local.activities.find((a) => a.id === id);
    if (target && !target.privateNote) notes[id] = note;
  }

  return {
    activities,
    gear,
    goals,
    settings: settings as Partial<ProfileSettings>,
    notes,
    counts: {
      activities: activities.length,
      gear: gear.length,
      goals: goals.length,
      notes: Object.keys(notes).length,
      settings: Object.keys(settings).length > 0,
    },
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What a restore would add, or did add, in plain words. */
export function restoreSummary(counts: MergeResult['counts']): string {
  const parts = [
    counts.activities > 0 && plural(counts.activities, 'activity', 'activities'),
    counts.gear > 0 && `${counts.gear} gear`,
    counts.goals > 0 && plural(counts.goals, 'goal', 'goals'),
    counts.notes > 0 && plural(counts.notes, 'note', 'notes'),
    counts.settings && 'your settings',
  ].filter((part): part is string => typeof part === 'string');
  if (parts.length === 0)
    return 'Everything in this backup is already on this phone. Nothing changes.';
  return `This adds ${parts.join(', ')}. Anything already on this phone is kept as it is.`;
}

export const BACKUP_PROBLEMS: Record<Extract<ParsedBackup, { ok: false }>['reason'], string> = {
  corrupted: 'This backup file is damaged, so nothing was restored.',
  newer_version: 'This backup was made by a newer version of Stryde. Update the app and try again.',
  not_a_backup: 'This is not a Stryde backup file.',
};
