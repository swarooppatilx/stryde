import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { select: () => ({}) } }));

const { Brand, Colors } = await import('@/constants/theme');

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// WCAG AA: 4.5:1 for body text.
const AA = 4.5;

describe.each(['light', 'dark'] as const)('%s theme contrast', (mode) => {
  const c = Colors[mode];

  const SURFACES = [
    'background',
    'backgroundElement',
    'backgroundSelected',
    'backgroundSunken',
  ] as const;

  it.each(SURFACES)('secondary text is readable on %s', (surface) => {
    expect(contrast(c.textSecondary, c[surface])).toBeGreaterThanOrEqual(AA);
  });

  it.each(SURFACES)('tertiary text is readable on %s', (surface) => {
    expect(contrast(c.textTertiary, c[surface])).toBeGreaterThanOrEqual(AA);
  });

  it.each(SURFACES)('small accent text is readable on %s', (surface) => {
    expect(contrast(c.accentText, c[surface])).toBeGreaterThanOrEqual(AA);
  });

  it.each(['successText', 'warningText', 'dangerText'] as const)(
    '%s is readable on every surface',
    (role) => {
      for (const surface of SURFACES) {
        expect(contrast(c[role], c[surface]), `${role} on ${surface}`).toBeGreaterThanOrEqual(AA);
      }
    }
  );

  it.each(SURFACES)('placeholder text stays legible (3:1) on %s', (surface) => {
    expect(contrast(c.placeholder, c[surface])).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('primary text is readable on every surface', () => {
    for (const surface of SURFACES) {
      expect(contrast(c.text, c[surface])).toBeGreaterThanOrEqual(AA);
    }
  });
});

const AA_LARGE = 3;

// A card has to read as its own surface on the page. In light mode that means white cards on the
// grey canvas (the reference's day theme); #FAFAFA cards on a white page are 1.04:1 and vanish.
describe.each(['light', 'dark'] as const)('%s theme surfaces', (mode) => {
  const c = Colors[mode];

  it('a card is distinguishable from the page it sits on', () => {
    expect(contrast(c.backgroundElement, c.background)).toBeGreaterThanOrEqual(1.1);
  });

  it('the bottom bar reads as a surface on the page', () => {
    expect(contrast(c.navbar, c.background)).toBeGreaterThanOrEqual(1.1);
  });

  // Menus, toasts and notices float over content; they use one surface so they all look alike.
  it('a floating surface stands apart from the page under it', () => {
    expect(contrast(c.backgroundOverlay, c.background)).toBeGreaterThanOrEqual(1.1);
  });

  it('text is readable on a floating surface', () => {
    expect(contrast(c.text, c.backgroundOverlay)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.textSecondary, c.backgroundOverlay)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.accentText, c.backgroundOverlay)).toBeGreaterThanOrEqual(AA);
  });
});

it('in light mode the card is the lighter surface, as in the reference', () => {
  expect(Colors.light.backgroundElement).toBe('#FFFFFF');
});

// White on the brand orange is about 3.3:1: enough for large or bold labels (3:1), short of
// AA for small text, so small orange text uses `accentText` instead (a darker orange in light mode).
describe('brand', () => {
  it('white labels on the brand orange meet the large-text bar', () => {
    expect(contrast(Brand.white, Brand.primary)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
