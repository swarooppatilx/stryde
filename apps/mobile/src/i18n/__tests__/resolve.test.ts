import { describe, expect, it } from 'vitest';
import { resolveLanguage } from '@/i18n/resolve';

describe('resolveLanguage', () => {
  it('uses an explicit choice over the phone', () => {
    expect(resolveLanguage('hi', 'en')).toBe('hi');
    expect(resolveLanguage('en', 'hi')).toBe('en');
  });

  it('follows the phone for system', () => {
    expect(resolveLanguage('system', 'hi')).toBe('hi');
    expect(resolveLanguage('system', 'en')).toBe('en');
  });

  it('falls back to English for a language that is not bundled or unknown', () => {
    expect(resolveLanguage('system', 'fr')).toBe('en');
    expect(resolveLanguage('system', null)).toBe('en');
    expect(resolveLanguage('system', undefined)).toBe('en');
  });
});
