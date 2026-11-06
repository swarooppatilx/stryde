import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Screens and components whose copy is fully routed through `t(`. Add a file here as it is converted. */
const CONVERTED = [
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/tracking.tsx',
  'app/settings.tsx',
  'app/preferences.tsx',
  'components/settings-screen.tsx',
  'components/readiness-card.tsx',
  'components/record-prerun.tsx',
];

/** Technical strings that are not shown as words, by exact text. */
const ALLOWLIST = new Set<string>([]);

const WORDS = /[A-Za-zऀ-ॿ]+(?:[\s][A-Za-zऀ-ॿ]+)+/;

/** Two or more words of visible text as a JSX child or a labelled prop, without an expression. */
export function untranslatedLiterals(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/>([^<>{}\n]+)</g)) {
    const text = (m[1] ?? '').trim();
    if (WORDS.test(text)) found.push(text);
  }
  for (const m of source.matchAll(/\n\s+([^<>{}\n=]*[A-Za-z]{2,}[^<>{}\n=]*)\n/g)) {
    const text = (m[1] ?? '').trim();
    if (/^(?:\/\/|\/\*|\*|import |export |const |return |let |if |type |interface )/.test(text))
      continue;
    if (/[;,()[\]'"`:&|?]|=>/.test(text)) continue;
    if (WORDS.test(text) && /^[A-Z"“]/.test(text)) found.push(text);
  }
  for (const m of source.matchAll(
    /\b(?:accessibilityLabel|accessibilityHint|title|label|placeholder)="([^"]+)"/g
  )) {
    const text = m[1] ?? '';
    if (WORDS.test(text)) found.push(text);
  }
  return found.filter((text) => !ALLOWLIST.has(text));
}

describe('untranslatedLiterals', () => {
  it('flags visible English that skips t(', () => {
    expect(untranslatedLiterals('<Text>Save your run</Text>')).toEqual(['Save your run']);
    expect(untranslatedLiterals('<Row title="Edit profile" />')).toEqual(['Edit profile']);
    expect(untranslatedLiterals('<Text accessibilityLabel="Go back" />')).toEqual(['Go back']);
  });

  it('leaves routed copy, single words and expressions alone', () => {
    expect(untranslatedLiterals("<Text>{t('a.b')}</Text>")).toEqual([]);
    expect(untranslatedLiterals('<Text>Hi</Text>')).toEqual([]);
    expect(untranslatedLiterals("<Row title={t('a.b')} />")).toEqual([]);
  });
});

describe('converted screens', () => {
  for (const file of CONVERTED) {
    it(`${file} routes visible copy through t(`, () => {
      const source = readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
      expect(untranslatedLiterals(source)).toEqual([]);
    });
  }
});
