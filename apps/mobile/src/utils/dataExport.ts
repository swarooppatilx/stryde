import type { Activity, Gear, Gender } from '@/types';
import type { ProfileSettings } from './profile';

interface ExportInput {
  profile: {
    username: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    birthday: string | null;
    wallet: string | null;
    settings: ProfileSettings;
  };
  activities: readonly Activity[];
  gear: readonly Gear[];
  now: Date;
}

const isPublished = (uri: string) => uri.startsWith('http');

/**
 * Everything this phone holds about the athlete, as JSON they can keep: profile, activities with
 * their routes and splits, and gear. Fields are picked by name so nothing secret (login ids,
 * tokens, keys) can ride along by accident.
 */
export function buildDataExport({ profile, activities, gear, now }: ExportInput): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: now.toISOString(),
      athlete: {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        gender: profile.gender,
        birthday: profile.birthday,
        account: profile.wallet,
        units: profile.settings.units,
        weightKg: profile.settings.weightKg ?? null,
      },
      gear,
      activities: activities.map((a) => ({
        id: a.id,
        name: a.name ?? null,
        type: a.activityType,
        startedAt: new Date(a.createdAt).toISOString(),
        distanceMeters: a.distance,
        durationMs: a.duration,
        route: a.polyline,
        splits: a.splits ?? null,
        laps: a.laps ?? null,
        bestEfforts: a.bestEfforts ?? null,
        stream: a.stream ?? null,
        elevationGainMeters: a.elevationGain ?? null,
        description: a.description ?? null,
        feel: a.feel ?? null,
        effort: a.effort ?? null,
        commute: a.isCommute ?? false,
        privateNote: a.privateNote ?? null,
        privacy: a.privacy ?? null,
        gearId: a.gearId ?? null,
        photos: (a.images ?? []).filter(isPublished),
        transaction: a.txHash ?? null,
      })),
    },
    null,
    2
  );
}
