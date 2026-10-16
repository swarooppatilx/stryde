import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/utils/contrast';

describe('contrastRatio', () => {
  it('is 21:1 for black on white, either way round', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#FC5200', '#FC5200')).toBeCloseTo(1, 5);
  });

  it('accepts short hex and any letter case', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('matches a known pair (brand orange on white is just over 3:1)', () => {
    expect(contrastRatio('#FC5200', '#FFFFFF')).toBeGreaterThan(3);
    expect(contrastRatio('#FC5200', '#FFFFFF')).toBeLessThan(3.6);
  });

  it('rejects a colour it cannot read', () => {
    expect(() => contrastRatio('orange', '#000')).toThrow('hex colour');
  });
});
