import { describe, expect, it } from 'vitest';
import { isoDateReviver } from '../storage';

describe('isoDateReviver', () => {
  it('converts ISO date strings to Date objects', () => {
    const iso = '2024-06-15T10:30:00.000Z';
    const result = isoDateReviver('key', iso);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe(iso);
  });

  it('returns non-date strings as-is', () => {
    expect(isoDateReviver('key', 'hello')).toBe('hello');
    expect(isoDateReviver('key', '2024-06-15')).toBe('2024-06-15');
  });

  it('returns non-string values as-is', () => {
    expect(isoDateReviver('key', 42)).toBe(42);
    expect(isoDateReviver('key', null)).toBe(null);
    expect(isoDateReviver('key', { nested: true })).toEqual({ nested: true });
  });

  it('returns boolean values as-is', () => {
    expect(isoDateReviver('key', true)).toBe(true);
    expect(isoDateReviver('key', false)).toBe(false);
  });

  it('ignores ISO-like strings without milliseconds', () => {
    expect(isoDateReviver('key', '2024-06-15T10:30:00Z')).toBe('2024-06-15T10:30:00Z');
  });
});
