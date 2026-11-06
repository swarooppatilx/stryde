import { t as defaultT, type TFunction } from '@/i18n';
import type { MapStylePref } from '@/stores/mapPrefsStore';
import { sensorsSubtitle } from '@/utils/sensorLive';

export const MAP_STYLE_LABELS: Record<MapStylePref, string> = {
  auto: 'Automatic',
  light: 'Light',
  dark: 'Dark',
};

const MAP_STYLE_KEY = {
  auto: 'flyout.mapAuto',
  light: 'flyout.mapLight',
  dark: 'flyout.mapDark',
} as const;

export function mapStyleLabel(style: MapStylePref, t: TFunction = defaultT): string {
  return t(MAP_STYLE_KEY[style]);
}

/** The stats island holds this many figures, the first of the athlete's live layout. */
const ISLAND_STAT_COUNT = 3;

/** The figures for the floating island: the live layout in order, skipping any with no data behind it. */
export function islandStatIds<T>(layout: readonly T[], isAvailable: (id: T) => boolean): T[] {
  return layout.filter(isAvailable).slice(0, ISLAND_STAT_COUNT);
}

export type FlyoutRowId = 'laps' | 'settings' | 'layers' | 'share' | 'sensor';

export interface FlyoutRow {
  id: FlyoutRowId;
  title: string;
  subtitle: string;
  /** False for an option that is not built yet: shown as a plain row, not a control. */
  available: boolean;
}

/** The options flyout: each row says what it is set to now. */
export function flyoutRows(
  {
    trackLaps,
    mapStyle,
    liveShare,
    sensors = { connected: 0, paired: 0 },
  }: {
    trackLaps: boolean;
    mapStyle: MapStylePref;
    /** Whether the live beacon is on; null when it cannot work here, which leaves the row out. */
    liveShare: boolean | null;
    /** How many Bluetooth sensors are connected and how many are paired. */
    sensors?: { connected: number; paired: number };
  },
  t: TFunction = defaultT
): FlyoutRow[] {
  const onOff = (on: boolean) => t(on ? 'common.on' : 'common.off');
  const share: FlyoutRow[] =
    liveShare === null
      ? []
      : [{ id: 'share', title: t('flyout.share'), subtitle: onOff(liveShare), available: true }];
  return [
    { id: 'laps', title: t('flyout.laps'), subtitle: onOff(trackLaps), available: true },
    {
      id: 'settings',
      title: t('flyout.settings'),
      subtitle: t('flyout.settingsHint'),
      available: true,
    },
    {
      id: 'layers',
      title: t('flyout.layers'),
      subtitle: mapStyleLabel(mapStyle, t),
      available: true,
    },
    ...share,
    {
      id: 'sensor',
      title: t('flyout.sensor'),
      subtitle: sensorsSubtitle(sensors, t),
      available: true,
    },
  ];
}
