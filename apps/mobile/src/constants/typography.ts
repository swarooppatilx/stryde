import type { TextStyle } from 'react-native';

export type FontWeightName = 'regular' | 'semibold' | 'bold' | 'heavy';

/** Face names as registered by the `expo-font` plugin. Styles carry the family and no numeric `fontWeight`, which would synthesise a second bolding. */
export const FontFamily: Record<FontWeightName, string> = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
};

type ScaleEntry = {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightName;
  letterSpacing?: number;
  uppercase?: boolean;
};

export const TypeScale = {
  display: { fontSize: 24, lineHeight: 30, weight: 'bold' },
  title: { fontSize: 20, lineHeight: 24, weight: 'bold' },
  titleSmall: { fontSize: 18, lineHeight: 22, weight: 'bold' },
  headline: { fontSize: 16, lineHeight: 20, weight: 'bold' },
  sectionTitle: { fontSize: 14, lineHeight: 18, weight: 'bold' },
  body: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  bodyBold: { fontSize: 13, lineHeight: 18, weight: 'bold' },
  callout: { fontSize: 12, lineHeight: 16, weight: 'regular' },
  calloutBold: { fontSize: 12, lineHeight: 16, weight: 'bold' },
  footnote: { fontSize: 11, lineHeight: 15, weight: 'regular' },
  footnoteBold: { fontSize: 11, lineHeight: 15, weight: 'bold' },
  stat: { fontSize: 20, lineHeight: 24, weight: 'bold' },
  countdown: { fontSize: 80, lineHeight: 92, weight: 'bold' },
  tabLabel: { fontSize: 11, lineHeight: 13, weight: 'bold' },
  eyebrow: {
    fontSize: 11,
    lineHeight: 13,
    weight: 'semibold',
    letterSpacing: 1.2,
    uppercase: true,
  },
} as const satisfies Record<string, ScaleEntry>;

export function textStyle(entry: ScaleEntry): TextStyle {
  return {
    fontFamily: FontFamily[entry.weight],
    fontSize: entry.fontSize,
    lineHeight: entry.lineHeight,
    ...(entry.letterSpacing !== undefined && { letterSpacing: entry.letterSpacing }),
    ...(entry.uppercase && { textTransform: 'uppercase' as const }),
  };
}

function numericWeight(fontWeight: NonNullable<TextStyle['fontWeight']>): number {
  if (fontWeight === 'bold') return 700;
  if (fontWeight === 'normal') return 400;
  return Number(fontWeight);
}

function weightName(fontWeight: NonNullable<TextStyle['fontWeight']>): FontWeightName {
  const numeric = numericWeight(fontWeight);
  if (numeric >= 800) return 'heavy';
  if (numeric >= 700) return 'bold';
  if (numeric >= 600) return 'semibold';
  return 'regular';
}

/** Maps inline `fontWeight` onto the embedded face. */
export function resolveTextStyle(style: TextStyle): TextStyle {
  const { fontWeight, ...rest } = style;
  if (fontWeight === undefined) return style;
  if (rest.fontFamily !== undefined) return rest;
  return { ...rest, fontFamily: FontFamily[weightName(fontWeight)] };
}
