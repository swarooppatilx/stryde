import { describe, expect, it } from 'vitest';
import { validateUsername } from '@/utils/username';

describe('validateUsername', () => {
  it('accepts a normal name and returns it trimmed', () => {
    expect(validateUsername('  swaroop  ')).toEqual({ ok: true, username: 'swaroop' });
  });

  it('accepts the shortest and longest allowed names', () => {
    expect(validateUsername('ab').ok).toBe(true);
    expect(validateUsername('a'.repeat(20)).ok).toBe(true);
  });

  it('rejects an empty or one-letter name, even padded with spaces', () => {
    expect(validateUsername('')).toEqual({
      ok: false,
      error: 'Username must be at least 2 characters',
    });
    expect(validateUsername('  a  ').ok).toBe(false);
    expect(validateUsername('     ').ok).toBe(false);
  });

  it('rejects a name over 20 characters', () => {
    expect(validateUsername('a'.repeat(21))).toEqual({
      ok: false,
      error: 'Username must be 20 characters or less',
    });
  });
});
