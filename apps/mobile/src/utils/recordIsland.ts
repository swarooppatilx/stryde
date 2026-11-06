import type { MapStylePref } from '@/stores/mapPrefsStore';
import { sensorsSubtitle } from '@/utils/sensorLive';

export const MAP_STYLE_LABELS: Record<MapStylePref, string> = {
  auto: 'Automatic',
  light: 'Light',
  dark: 'Dark',
};

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
export function flyoutRows({
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
}): FlyoutRow[] {
  const share: FlyoutRow[] =
    liveShare === null
      ? []
      : [
          {
            id: 'share',
            title: 'Share live location',
            subtitle: liveShare ? 'On' : 'Off',
            available: true,
          },
        ];
  return [
    { id: 'laps', title: 'Track laps', subtitle: trackLaps ? 'On' : 'Off', available: true },
    {
      id: 'settings',
      title: 'Recording settings',
      subtitle: 'Audio cues, auto-pause',
      available: true,
    },
    { id: 'layers', title: 'Map layers', subtitle: MAP_STYLE_LABELS[mapStyle], available: true },
    ...share,
    { id: 'sensor', title: 'Add a sensor', subtitle: sensorsSubtitle(sensors), available: true },
  ];
}
