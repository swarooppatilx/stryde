import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import { en } from '@/i18n/locales/en';
import { hi } from '@/i18n/locales/hi';

function flatten(node: object, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

/** Surfaces that name the token on purpose; see the protected-surfaces note in constants/copy.ts. */
const BANNED_WORD_EXEMPT = new Set(['settings.cashOut']);

const LATIN_ONLY = new Set(['summary.gps', 'settings.accountSubtitle']);

const flatEn = flatten(en);
const flatHi = flatten(hi);

describe('locale files', () => {
  it('carry the same keys', () => {
    expect(Object.keys(flatHi).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('use the same placeholders per key', () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(placeholders(flatHi[key] ?? ''), key).toEqual(placeholders(value));
    }
  });

  it('have no empty values', () => {
    for (const [key, value] of Object.entries({ ...flatEn, ...flatHi })) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('keep the English copy free of plumbing words', () => {
    for (const [key, value] of Object.entries(flatEn)) {
      if (BANNED_WORD_EXEMPT.has(key)) continue;
      expect(value, key).not.toMatch(BANNED_USER_WORDS);
    }
  });

  it('write Hindi in Devanagari, apart from brand names and units', () => {
    const plain = (text: string) => text.replace(/\{\{\w+\}\}/g, '');
    for (const [key, value] of Object.entries(flatHi)) {
      if (key.startsWith('language.') || LATIN_ONLY.has(key)) continue;
      expect(plain(value), key).toMatch(/[ऀ-ॿ]/);
    }
  });

  it('pair every plural key', () => {
    for (const key of Object.keys(flatEn)) {
      if (key.endsWith('_one')) expect(flatEn[`${key.slice(0, -4)}_other`], key).toBeDefined();
    }
  });
});

describe('plural rules', () => {
  it('are available and pick one/other for both languages', () => {
    expect(typeof Intl.PluralRules).toBe('function');
    expect(new Intl.PluralRules('en').select(1)).toBe('one');
    expect(new Intl.PluralRules('en').select(2)).toBe('other');
    expect(new Intl.PluralRules('hi').select(0)).toBe('one');
    expect(new Intl.PluralRules('hi').select(5)).toBe('other');
  });
});
