import { describe, expect, it } from 'vitest';
import { SHIMMER_PRESETS } from '@/components/Shimmer/const';

/** Relative luminance (0 black, 1 white) of an `rgb(...)`/`rgba(...)` string. */
function luminance(colour: string): number {
  const channels = (colour.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((n) => Number(n) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('shimmer presets are named for the theme they sit on', () => {
  it('onLight is a light grey placeholder, not a dark block, on a light page', () => {
    const base = SHIMMER_PRESETS.onLight.backgroundColor;

    expect(base).toBeDefined();
    expect(luminance(base ?? '')).toBeGreaterThan(0.6);
  });

  it('onDark stays a dark placeholder', () => {
    expect(luminance(SHIMMER_PRESETS.onDark.backgroundColor ?? '')).toBeLessThan(0.05);
  });

  it('the onLight sweep is a lighter band over its base, so it still reads as moving', () => {
    const { colors, backgroundColor } = SHIMMER_PRESETS.onLight;
    const peak = Math.max(...colors.map(luminance));

    expect(peak).toBeGreaterThan(luminance(backgroundColor ?? ''));
  });
});
