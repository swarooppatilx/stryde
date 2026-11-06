import { HEAT_RAMP, tint } from '@/constants/theme';

/** The heatmap colour choices, including the ramp Stryde launched with. */
export const HEATMAP_COLORS = [
  'classic',
  'blue',
  'orange',
  'pink',
  'purple',
  'sunset',
  'contrast',
] as const;
export type HeatmapColor = (typeof HEATMAP_COLORS)[number];

export const HEATMAP_COLOR_OPTIONS: readonly { value: HeatmapColor; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'blue', label: 'Blue' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Purple' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'contrast', label: 'Contrast' },
];

type Ramp = readonly (readonly [number, string])[];

/** Five stops, clear at the lowest density so the base map shows where nobody has been, hot at the top. */
const ramp = (low: string, mid: string, high: string, hottest: string): Ramp => [
  [0, tint(low, 0)],
  [0.25, tint(low, 0.45)],
  [0.5, tint(mid, 0.6)],
  [0.75, tint(high, 0.75)],
  [1, tint(hottest, 0.92)],
];

const RAMPS: Record<Exclude<HeatmapColor, 'classic'>, Ramp> = {
  blue: ramp('#6EC1FF', '#2F8CFF', '#1B5FE0', '#0B2E9E'),
  orange: ramp('#FFC08A', '#FF9440', '#FC5200', '#B83A00'),
  pink: ramp('#FFB3D9', '#FF70B8', '#F0309A', '#A8105F'),
  purple: ramp('#D2B4FF', '#A878F5', '#7D3FE0', '#4A1A9C'),
  sunset: ramp('#FFD84D', '#FF9A3C', '#F0453A', '#8F2A8F'),
  // Bright against both light and dark base maps, for anyone who cannot read the soft ramps.
  contrast: ramp('#FFFFFF', '#FFE600', '#FF7A00', '#E6001F'),
};

/** The colour ramp for the heatmap layer; classic for an id it does not know. */
export function heatRampFor(color: HeatmapColor): Ramp {
  return color === 'classic' ? HEAT_RAMP : (RAMPS[color] ?? HEAT_RAMP);
}
