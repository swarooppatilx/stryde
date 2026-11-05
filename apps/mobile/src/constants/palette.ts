/** Primitive colour ramps, mapped to semantic roles in `theme.ts`. Dark mode mirrors the neutral ramp (n00 darkest, n7 lightest); orange stays fixed. */
export const Palette = {
  white: '#FFFFFF',
  black: '#000000',
  neutral: {
    n00: '#000000',
    n05: '#141413',
    n1: '#21211F',
    n2: '#43423F',
    n3: '#64635E',
    n4: '#918E89',
    n45: '#C2C1BB',
    n5: '#E0E0DE',
    n6: '#F2F2F0',
    n7: '#FAFAFA',
  },
  orange: {
    o2: '#C94100',
    // Between o2 and o1: the lightest orange that still reads as small text (>= 4.5:1) on
    // every light surface, including the selected-row grey.
    o25: '#B83801',
    o3: '#FC5200',
    o7: '#FFE7CC',
  },
  green: { g1: '#437C16', g2: '#59A51D', g4: '#8CD850' },
  red: { r2: '#B71414', r3: '#DF2626', r5: '#EF7575' },
  yellow: { y05: '#654F00', y3: '#FFC700' },
  violet: { v3: '#A63DE7' },
  pink: { p3: '#E127B7' },
  blue: { b3: '#0060D0', b4: '#337FD9' },
} as const;
