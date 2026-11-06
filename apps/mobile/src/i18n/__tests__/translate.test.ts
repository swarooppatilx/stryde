import { afterEach, describe, expect, it } from 'vitest';
import { currentLanguage, setLanguage, t } from '@/i18n';
import { en } from '@/i18n/locales/en';
import { hi } from '@/i18n/locales/hi';

afterEach(() => setLanguage('en'));

describe('t', () => {
  it('returns the English value in en', () => {
    setLanguage('en');
    expect(t('tabs.home')).toBe(en.tabs.home);
    expect(t('settings.title')).toBe('Settings');
  });

  it('returns the Hindi value in hi', () => {
    setLanguage('hi');
    expect(currentLanguage()).toBe('hi');
    expect(t('tabs.home')).toBe(hi.tabs.home);
    expect(t('settings.title')).toBe(hi.settings.title);
  });

  it('fills placeholders', () => {
    expect(t('settings.version', { version: '1.2' })).toBe('Version 1.2');
    setLanguage('hi');
    expect(t('settings.version', { version: '1.2' })).toBe('संस्करण 1.2');
  });

  it('picks the plural form', () => {
    expect(t('summary.places', { count: 1 })).toBe('1 place');
    expect(t('summary.places', { count: 3 })).toBe('3 places');
    setLanguage('hi');
    expect(t('summary.places', { count: 1 })).toBe('1 जगह');
    expect(t('summary.places', { count: 3 })).toBe('3 जगहें');
  });

  it('does not escape values', () => {
    expect(t('settings.accountSubtitle', { who: 'a&b@x.io', state: 'ok' })).toBe(
      'a&b@x.io · World ID ok'
    );
  });

  it('rejects a key that is not in the English resource at compile time', () => {
    // @ts-expect-error not a key
    t('tabs.missing');
  });
});
