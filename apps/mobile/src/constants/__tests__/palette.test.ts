import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { select: () => ({}) } }));

const { Brand, Colors, HEAT_RAMP, OTHERS_TERRITORY_COLOR } = await import('@/constants/theme');
const { Palette } = await import('@/constants/palette');

describe('Colors', () => {
  it('defines the same roles in both modes', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  it('builds every role from the palette, so no screen needs its own hex', () => {
    const known = new Set<string>([
      ...Object.values(Palette.neutral),
      ...Object.values(Palette.orange),
      ...Object.values(Palette.green),
      ...Object.values(Palette.red),
      ...Object.values(Palette.yellow),
      ...Object.values(Palette.blue),
      ...Object.values(Palette.violet),
      ...Object.values(Palette.pink),
      Palette.white,
      Palette.black,
    ]);
    for (const mode of [Colors.light, Colors.dark]) {
      for (const [role, hex] of Object.entries(mode)) {
        expect(known.has(hex), `${role} ${hex}`).toBe(true);
      }
    }
  });

  // Dark text is the white that a light card is made of, and the dark page is the black of light text.
  // (It is no longer the light page colour: light mode's page is the grey canvas, cards are white.)
  it('mirrors the neutral ramp in dark mode', () => {
    expect(Colors.dark.background).toBe(Colors.light.text);
    expect(Colors.dark.text).toBe(Colors.light.backgroundElement);
  });

  it('puts raised cards on a canvas: grey page and white cards in light, near-black cards on black in dark', () => {
    expect(Colors.light.background).toBe(Palette.neutral.n6);
    expect(Colors.light.backgroundElement).toBe(Palette.white);
    expect(Colors.light.backgroundSelected).toBe(Palette.neutral.n6);
    expect(Colors.dark.background).toBe(Palette.black);
    expect(Colors.dark.backgroundElement).toBe(Palette.neutral.n05);
    expect(Colors.dark.backgroundSelected).toBe(Palette.neutral.n1);
  });

  it('keeps the text hierarchy distinct from strongest to faintest', () => {
    for (const mode of [Colors.light, Colors.dark]) {
      expect(new Set([mode.text, mode.textSecondary, mode.textTertiary, mode.disabled]).size).toBe(
        4
      );
    }
  });
});

describe('Brand', () => {
  it('uses the palette orange for fills and its pressed step', () => {
    expect(Brand.primary).toBe(Palette.orange.o3);
    expect(Brand.primaryPressed).toBe(Palette.orange.o2);
  });
});

describe('Brand status colours', () => {
  it('come from the palette', () => {
    expect(Brand.success).toBe(Palette.green.g2);
    expect(Brand.danger).toBe(Palette.red.r3);
    expect(Brand.warning).toBe(Palette.yellow.y3);
    expect(Brand.info).toBe(Palette.blue.b3);
  });
});

describe('map colours', () => {
  it('draws other athletes in violet from the palette', () => {
    expect(OTHERS_TERRITORY_COLOR).toBe(Palette.violet.v3);
  });

  it('builds the heat ramp from cool to hot with stops rising from 0 to 1', () => {
    const stops = HEAT_RAMP.map(([stop]) => stop);
    expect(stops[0]).toBe(0);
    expect(stops.at(-1)).toBe(1);
    expect(stops).toEqual([...stops].sort((a, b) => a - b));
    expect(HEAT_RAMP).toHaveLength(5);
  });
});
