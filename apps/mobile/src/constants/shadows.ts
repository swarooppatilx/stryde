import type { ViewStyle } from 'react-native';

type Elevation = 'card' | 'raised' | 'overlay' | 'sheet' | 'pin';

const shadow = (boxShadow: string): Pick<ViewStyle, 'boxShadow'> => ({ boxShadow });

/** Elevations as `boxShadow` per mode; the dark set is stronger because a black shadow vanishes on dark surfaces. For floating layers only. */
export const Shadows: Record<'light' | 'dark', Record<Elevation, Pick<ViewStyle, 'boxShadow'>>> = {
  light: {
    card: shadow('0 1px 4px rgba(0, 0, 0, 0.06)'),
    raised: shadow('0 2px 8px rgba(0, 0, 0, 0.12)'),
    overlay: shadow('0 8px 24px rgba(0, 0, 0, 0.14)'),
    sheet: shadow('0 -2px 12px rgba(0, 0, 0, 0.15)'),
    pin: shadow('0 2px 4px rgba(0, 0, 0, 0.3)'),
  },
  dark: {
    card: shadow('0 1px 4px rgba(0, 0, 0, 0.22)'),
    raised: shadow('0 2px 8px rgba(0, 0, 0, 0.3)'),
    overlay: shadow('0 8px 24px rgba(0, 0, 0, 0.45)'),
    sheet: shadow('0 -2px 12px rgba(0, 0, 0, 0.45)'),
    pin: shadow('0 2px 4px rgba(0, 0, 0, 0.5)'),
  },
};
