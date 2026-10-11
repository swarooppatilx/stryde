import { describe, expect, it } from 'vitest';
import { effortLabel } from '@/utils/effortLabel';

describe('effortLabel', () => {
  it('names the standard distances the way athletes say them', () => {
    expect(effortLabel(400)).toBe('400 m');
    expect(effortLabel(1000)).toBe('1 km');
    expect(effortLabel(1609)).toBe('1 mile');
    expect(effortLabel(5000)).toBe('5 km');
    expect(effortLabel(10_000)).toBe('10 km');
    expect(effortLabel(21_097)).toBe('Half marathon');
    expect(effortLabel(42_195)).toBe('Marathon');
  });

  it('falls back to kilometres or metres for any other distance', () => {
    expect(effortLabel(3000)).toBe('3 km');
    expect(effortLabel(2500)).toBe('2.5 km');
    expect(effortLabel(800)).toBe('800 m');
  });
});
