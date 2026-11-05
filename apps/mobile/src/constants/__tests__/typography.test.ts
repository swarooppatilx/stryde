import { describe, expect, it } from 'vitest';

import { FontFamily, resolveTextStyle, TypeScale, textStyle } from '@/constants/typography';

describe('TypeScale', () => {
  it.each([
    ['display', 24, 30],
    ['title', 20, 24],
    ['titleSmall', 18, 22],
    ['headline', 16, 20],
    ['sectionTitle', 14, 18],
    ['body', 13, 18],
    ['callout', 12, 16],
    ['footnote', 11, 15],
    ['footnoteBold', 11, 15],
    ['eyebrow', 11, 13],
    ['tabLabel', 11, 13],
    ['stat', 20, 24],
    ['countdown', 80, 92],
  ] as const)('%s is %ipt on a %ipt line', (name, size, line) => {
    expect(TypeScale[name].fontSize).toBe(size);
    expect(TypeScale[name].lineHeight).toBe(line);
  });

  it('never sets a line height tighter than its font size', () => {
    for (const entry of Object.values(TypeScale)) {
      expect(entry.lineHeight).toBeGreaterThan(entry.fontSize);
    }
  });

  it('keeps every style at or above the 11pt floor, so the smallest text stays readable', () => {
    for (const entry of Object.values(TypeScale)) {
      expect(entry.fontSize).toBeGreaterThanOrEqual(11);
    }
  });

  it('gets smaller from the titles down to the captions, never the other way', () => {
    const order = [
      'display',
      'title',
      'titleSmall',
      'headline',
      'sectionTitle',
      'body',
      'callout',
      'footnote',
    ] as const;
    const sizes = order.map((name) => TypeScale[name].fontSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });
});

describe('textStyle', () => {
  it('picks the font face from the weight and leaves fontWeight unset', () => {
    const style = textStyle(TypeScale.sectionTitle);
    expect(style.fontFamily).toBe(FontFamily.bold);
    expect(style).not.toHaveProperty('fontWeight');
  });

  it('upper-cases and tracks out labels', () => {
    const style = textStyle(TypeScale.eyebrow);
    expect(style.textTransform).toBe('uppercase');
    expect(style.letterSpacing).toBeGreaterThan(0);
  });
});

describe('resolveTextStyle', () => {
  it('turns an inline fontWeight into the matching face', () => {
    expect(resolveTextStyle({ fontWeight: '700' })).toEqual({ fontFamily: FontFamily.bold });
    expect(resolveTextStyle({ fontWeight: '800' })).toEqual({ fontFamily: FontFamily.heavy });
    expect(resolveTextStyle({ fontWeight: '600' })).toEqual({ fontFamily: FontFamily.semibold });
  });

  it('treats medium and normal as regular', () => {
    expect(resolveTextStyle({ fontWeight: '500' })).toEqual({ fontFamily: FontFamily.regular });
    expect(resolveTextStyle({ fontWeight: 'normal' })).toEqual({ fontFamily: FontFamily.regular });
    expect(resolveTextStyle({ fontWeight: 'bold' })).toEqual({ fontFamily: FontFamily.bold });
  });

  it('keeps every other property and any explicit family', () => {
    expect(resolveTextStyle({ fontSize: 40, fontWeight: '700' })).toEqual({
      fontSize: 40,
      fontFamily: FontFamily.bold,
    });
    expect(resolveTextStyle({ fontFamily: 'monospace', fontWeight: '700' })).toEqual({
      fontFamily: 'monospace',
    });
  });

  it('returns the style untouched when no weight is set', () => {
    expect(resolveTextStyle({ fontSize: 12 })).toEqual({ fontSize: 12 });
  });
});
