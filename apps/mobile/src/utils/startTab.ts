/** The tabs the app can open on. Home is the default; You is not offered (it is reached from anywhere). */
export const START_TABS = [
  { value: 'index', label: 'Home' },
  { value: 'tracking', label: 'Record' },
  { value: 'map', label: 'Maps' },
  { value: 'groups', label: 'Groups' },
] as const;

export type StartTab = (typeof START_TABS)[number]['value'];

/** Where to send the athlete at launch, or null when the default (Home) is already right. */
export function startTabRoute(tab: StartTab): string | null {
  return tab === 'index' ? null : `/(tabs)/${tab}`;
}

/**
 * Whether to open the chosen tab now: only when the app has just landed on the tabs with no
 * particular one asked for, so a link or a notification that names a tab is not overridden.
 */
export function shouldOpenStartTab(tab: StartTab, segments: readonly string[]): boolean {
  if (startTabRoute(tab) === null || segments[0] !== '(tabs)') return false;
  const asked = segments[1];
  return asked === undefined || asked === 'index';
}
