import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { select: () => ({}) } }));

const { BorderRadius, IconSize, Spacing, Touch } = await import('@/constants/theme');

describe('Spacing', () => {
  it('sits on a 2pt grid, ascending', () => {
    const steps = Object.values(Spacing);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    for (const step of steps) expect(step % 2).toBe(0);
  });

  it('has named steps for the in-between sizes screens kept hard-coding', () => {
    expect(Spacing.twoHalf).toBe(12);
    expect(Spacing.threeHalf).toBe(20);
  });

  it('keeps the existing steps', () => {
    expect([Spacing.one, Spacing.two, Spacing.three, Spacing.four, Spacing.five]).toEqual([
      4, 8, 16, 24, 32,
    ]);
  });
});

describe('BorderRadius', () => {
  it('grows from hairline corners to a pill', () => {
    const rounded = [
      BorderRadius.xxs,
      BorderRadius.xs,
      BorderRadius.sm,
      BorderRadius.md,
      BorderRadius.lg,
      BorderRadius.xl,
      BorderRadius.xxl,
    ];
    expect(rounded).toEqual([2, 4, 8, 12, 16, 24, 32]);
    expect(BorderRadius.full).toBeGreaterThan(BorderRadius.xxl);
  });
});

describe('IconSize', () => {
  it('holds the five role sizes', () => {
    expect(IconSize).toEqual({ badge: 16, inline: 18, action: 24, stat: 32, hero: 40 });
  });
});

describe('Touch', () => {
  it('meets the Android 48dp minimum for every touch surface', () => {
    for (const t of Object.values(Touch)) expect(t).toBeGreaterThanOrEqual(48);
  });
});
