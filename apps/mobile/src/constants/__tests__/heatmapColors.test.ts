import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { select: () => ({}) } }));

const { HEAT_RAMP } = await import('@/constants/theme');
const { HEATMAP_COLOR_OPTIONS, HEATMAP_COLORS, heatRampFor } = await import(
  '@/constants/heatmapColors'
);

describe('heatmap colours', () => {
  it('offers the standard colour choices, plus the one Stryde started with', () => {
    expect(HEATMAP_COLORS).toEqual([
      'classic',
      'blue',
      'orange',
      'pink',
      'purple',
      'sunset',
      'contrast',
    ]);
    expect(HEATMAP_COLOR_OPTIONS.map((o) => o.label)).toEqual([
      'Classic',
      'Blue',
      'Orange',
      'Pink',
      'Purple',
      'Sunset',
      'Contrast',
    ]);
  });

  it('keeps the classic ramp exactly as it was', () => {
    expect(heatRampFor('classic')).toEqual(HEAT_RAMP);
  });

  it.each(HEATMAP_COLORS)('%s is a five-stop ramp from clear to its hottest colour', (id) => {
    const ramp = heatRampFor(id);
    expect(ramp).toHaveLength(5);
    expect(ramp.map(([stop]) => stop)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    // The lowest density stays see-through, or the whole map is tinted where nobody has been.
    expect(ramp[0]?.[1]).toMatch(/,\s*0\)$/);
  });

  it('gives each non-classic palette its own look', () => {
    const hottest = HEATMAP_COLORS.filter((id) => id !== 'classic').map(
      (id) => heatRampFor(id)[4]?.[1]
    );
    expect(new Set(hottest).size).toBe(hottest.length);
  });

  it('falls back to classic for an unknown id', () => {
    expect(heatRampFor('nope' as never)).toEqual(HEAT_RAMP);
  });
});
