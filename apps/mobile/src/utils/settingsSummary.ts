import type { ActivityPrivacy } from '@/types';
import { formatDistance, formatDuration } from '@/utils/format';
import { WEEK_START_OPTIONS, type WeekStartDay } from '@/utils/trainingLog';

type UnitSystem = 'metric' | 'imperial';
type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREF_LABEL: Record<ThemePreference, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export const UNIT_LABEL: Record<UnitSystem, string> = {
  metric: 'Metric',
  imperial: 'Imperial',
};

export const PRIVACY_LABEL: Record<ActivityPrivacy, string> = {
  everyone: 'Everyone',
  followers: 'Followers',
  only_me: 'Only Me',
};

export function weekStartLabel(day: WeekStartDay): string {
  return WEEK_START_OPTIONS.find((o) => o.value === day)?.label ?? 'Sunday';
}

export function preferencesSummary(p: {
  theme: ThemePreference;
  units: UnitSystem;
  weekStartsOn: WeekStartDay;
}): string {
  return [THEME_PREF_LABEL[p.theme], UNIT_LABEL[p.units], weekStartLabel(p.weekStartsOn)].join(
    ' · '
  );
}

export function weeklyGoalsSummary(g: {
  weeklyGoalDistance: number;
  weeklyGoalActivities: number;
  weeklyGoalTime: number;
  units: UnitSystem;
}): string {
  const activities = `${g.weeklyGoalActivities} ${g.weeklyGoalActivities === 1 ? 'activity' : 'activities'}`;
  return [
    formatDistance(g.weeklyGoalDistance, g.units),
    activities,
    formatDuration(g.weeklyGoalTime),
  ].join(' · ');
}

export function privateZonesSummary(count: number): string {
  if (count === 0) return 'None';
  return `${count} ${count === 1 ? 'place' : 'places'}`;
}

export function privacySummary(visibility: ActivityPrivacy, zoneCount: number): string {
  const zones = zoneCount === 0 ? 'no private places' : privateZonesSummary(zoneCount);
  return `${PRIVACY_LABEL[visibility]} · ${zones}`;
}

/** The phone's notification permission in words; null is a phone that would not say. */
export function notificationPermissionLabel(allowed: boolean | null): string {
  if (allowed === null) return 'Not available';
  return allowed ? 'On' : 'Off in phone settings';
}

export function notificationsSummary(
  allowed: boolean | null,
  enabled: number,
  total: number
): string {
  const types = enabled === total ? `all ${total} types` : `${enabled} of ${total} types`;
  return `${notificationPermissionLabel(allowed)} · ${types}`;
}

export function recordingSummary(s: {
  autoPause: boolean;
  autoPauseOnFoot: boolean;
  countdownSeconds: number;
  accuracyLabel: string;
}): string {
  const autoPause = s.autoPause || s.autoPauseOnFoot ? 'Auto-pause on' : 'Auto-pause off';
  const countdown = s.countdownSeconds === 0 ? 'no countdown' : `${s.countdownSeconds} s countdown`;
  return [autoPause, countdown, `GPS ${s.accuracyLabel.toLowerCase()}`].join(' · ');
}
