import { describe, expect, it } from 'vitest';

import { Shadows } from '@/constants/shadows';

const LEGACY = ['shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation'];

describe.each(['light', 'dark'] as const)('%s shadows', (mode) => {
  const set = Shadows[mode];

  it('offers the same elevations in both modes', () => {
    expect(Object.keys(Shadows.dark).sort()).toEqual(Object.keys(Shadows.light).sort());
  });

  it.each(Object.keys(Shadows.light))('%s is a single boxShadow and no legacy props', (name) => {
    const style = set[name as keyof typeof set] as Record<string, unknown>;
    expect(Object.keys(style)).toEqual(['boxShadow']);
    expect(String(style.boxShadow)).toMatch(/^-?\d+(px)? -?\d+px \d+px rgba\(0, 0, 0, [\d.]+\)$/);
    for (const prop of LEGACY) expect(style).not.toHaveProperty(prop);
  });

  it('lifts higher surfaces with a longer, softer shadow', () => {
    const blur = (s: object) =>
      Number(/ (\d+)px rgba/.exec(String((s as { boxShadow: string }).boxShadow))?.[1]);
    expect(blur(set.card)).toBeLessThan(blur(set.raised));
    expect(blur(set.raised)).toBeLessThan(blur(set.overlay));
  });
});

describe('dark shadows', () => {
  it('are stronger than light ones, where black shadows vanish', () => {
    const alpha = (s: object) =>
      Number(/, ([\d.]+)\)$/.exec(String((s as { boxShadow: string }).boxShadow))?.[1]);
    expect(alpha(Shadows.dark.card)).toBeGreaterThan(alpha(Shadows.light.card));
  });
});
