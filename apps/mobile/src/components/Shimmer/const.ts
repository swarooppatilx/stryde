import type { IShimmerColorTheme, ShimmerPreset } from './Shimmer.types';

const SHIMMER_PRESETS: Record<ShimmerPreset, IShimmerColorTheme> = {
  onDark: {
    colors: [
      'rgba(28, 28, 28, 1)',
      'rgba(38, 38, 38, 1)',
      'rgba(58, 58, 58, 1)',
      'rgba(38, 38, 38, 1)',
      'rgba(28, 28, 28, 1)',
    ],
    backgroundColor: 'rgba(28, 28, 28, 1)',
  },
  // A light-grey placeholder with a slightly lighter band sweeping over it. (This slot used to be a
  // charcoal base with a white sweep under the name "light", so every light-mode skeleton was a dark block.)
  onLight: {
    colors: ['rgb(232, 232, 229)', 'rgb(246, 246, 244)', 'rgb(232, 232, 229)'],
    backgroundColor: 'rgb(232, 232, 229)',
  },
  twitter: {
    colors: ['rgba(47, 51, 54, 1)', 'rgba(71, 75, 78, 1)', 'rgba(47, 51, 54, 1)'],
    backgroundColor: 'rgba(32, 35, 39, 1)',
  },
  neutral: {
    colors: ['rgba(200, 200, 200, 1)', 'rgba(235, 235, 235, 1)', 'rgba(200, 200, 200, 1)'],
    backgroundColor: 'rgba(190, 190, 190, 1)',
  },
  custom: {
    colors: ['rgba(15, 15, 15, 0.1)', 'rgba(255, 255, 255, 0.15)', 'rgba(15, 15, 15, 0.1)'],
  },
};

/** The placeholder preset for the theme the skeleton sits on. */
function shimmerPresetFor(isDark: boolean): ShimmerPreset {
  return isDark ? 'onDark' : 'onLight';
}

export { SHIMMER_PRESETS, shimmerPresetFor };
