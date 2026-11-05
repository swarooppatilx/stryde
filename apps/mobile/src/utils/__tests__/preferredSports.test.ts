import { describe, expect, it } from 'vitest';
import { sanitizePreferredSports, toggleSport } from '@/utils/preferredSports';

describe('toggleSport', () => {
  it('adds a sport at the end and removes it when picked again', () => {
    expect(toggleSport(['swim'], 'run')).toEqual(['swim', 'run']);
    expect(toggleSport(['swim', 'run'], 'swim')).toEqual(['run']);
  });
});

describe('sanitizePreferredSports', () => {
  it('drops unknown, repeated and non-text entries', () => {
    expect(sanitizePreferredSports(['run', 'quidditch', 'run', 4, 'ride'])).toEqual([
      'run',
      'ride',
    ]);
  });
  it('gives an empty list for anything that is not a list', () => {
    expect(sanitizePreferredSports(undefined)).toEqual([]);
    expect(sanitizePreferredSports('run')).toEqual([]);
  });
});
