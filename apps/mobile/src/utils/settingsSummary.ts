import { t as defaultT, type LanguageSetting, type TFunction } from '@/i18n';
import type { ActivityPrivacy } from '@/types';
import type { WeekStartDay } from '@/utils/trainingLog';

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

const THEME_KEY = {
  system: 'summary.themeAuto',
  light: 'summary.themeLight',
  dark: 'summary.themeDark',
} as const;

const UNIT_KEY = { metric: 'summary.unitsMetric', imperial: 'summary.unitsImperial' } as const;

const PRIVACY_KEY = {
  everyone: 'summary.privacyEveryone',
  followers: 'summary.privacyFollowers',
  only_me: 'summary.privacyOnlyMe',
} as const;

const LANGUAGE_KEY = {
  system: 'language.system',
  en: 'language.english',
  hi: 'language.hindi',
} as const;

export function themeLabel(theme: ThemePreference, t: TFunction = defaultT): string {
  return t(THEME_KEY[theme]);
}

export function unitLabel(units: UnitSystem, t: TFunction = defaultT): string {
  return t(UNIT_KEY[units]);
}

export function privacyLabel(visibility: ActivityPrivacy, t: TFunction = defaultT): string {
  return t(PRIVACY_KEY[visibility]);
}

export function languageLabel(language: LanguageSetting, t: TFunction = defaultT): string {
  return t(LANGUAGE_KEY[language]);
}

export function weekStartLabel(day: WeekStartDay, t: TFunction = defaultT): string {
  return t(day === 1 ? 'summary.weekMonday' : 'summary.weekSunday');
}

export function preferencesSummary(
  p: {
    theme: ThemePreference;
    units: UnitSystem;
    weekStartsOn: WeekStartDay;
    language?: LanguageSetting;
  },
  t: TFunction = defaultT
): string {
  const parts = [themeLabel(p.theme, t), unitLabel(p.units, t), weekStartLabel(p.weekStartsOn, t)];
  if (p.language) parts.push(languageLabel(p.language, t));
  return parts.join(' · ');
}

export function privateZonesSummary(count: number, t: TFunction = defaultT): string {
  if (count === 0) return t('common.none');
  return t('summary.places', { count });
}

export function privacySummary(
  visibility: ActivityPrivacy,
  zoneCount: number,
  t: TFunction = defaultT
): string {
  const zones = zoneCount === 0 ? t('summary.noPrivatePlaces') : privateZonesSummary(zoneCount, t);
  return `${privacyLabel(visibility, t)} · ${zones}`;
}

/** The phone's notification permission in words; null is a phone that would not say. */
export function notificationPermissionLabel(
  allowed: boolean | null,
  t: TFunction = defaultT
): string {
  if (allowed === null) return t('summary.notificationsNotAvailable');
  return allowed ? t('common.on') : t('summary.notificationsOffInPhone');
}

export function notificationsSummary(
  allowed: boolean | null,
  enabled: number,
  total: number,
  t: TFunction = defaultT
): string {
  const types =
    enabled === total
      ? t('summary.typesAll', { total })
      : t('summary.typesSome', { enabled, total });
  return `${notificationPermissionLabel(allowed, t)} · ${types}`;
}

export function recordingSummary(
  s: {
    autoPause: boolean;
    autoPauseOnFoot: boolean;
    countdownSeconds: number;
    accuracyLabel: string;
  },
  t: TFunction = defaultT
): string {
  const autoPause = t(
    s.autoPause || s.autoPauseOnFoot ? 'summary.autoPauseOn' : 'summary.autoPauseOff'
  );
  const countdown =
    s.countdownSeconds === 0
      ? t('summary.noCountdown')
      : t('summary.countdown', { seconds: s.countdownSeconds });
  return [autoPause, countdown, t('summary.gps', { level: s.accuracyLabel.toLowerCase() })].join(
    ' · '
  );
}
