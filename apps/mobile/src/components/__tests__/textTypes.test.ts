import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXT_TYPE_STYLES } from '@/components/textTypes';
import { TypeScale, textStyle } from '@/constants/typography';

describe('TEXT_TYPE_STYLES', () => {
  it('maps each title type to its own step of the scale', () => {
    expect(TEXT_TYPE_STYLES.display).toEqual(textStyle(TypeScale.display));
    expect(TEXT_TYPE_STYLES.title).toEqual(textStyle(TypeScale.title));
    expect(TEXT_TYPE_STYLES.titleSmall).toEqual(textStyle(TypeScale.titleSmall));
  });

  it('keeps the body-level types on the body steps', () => {
    expect(TEXT_TYPE_STYLES.default).toEqual(textStyle(TypeScale.body));
    expect(TEXT_TYPE_STYLES.small).toEqual(textStyle(TypeScale.callout));
    expect(TEXT_TYPE_STYLES.caption).toEqual(textStyle(TypeScale.footnote));
  });
});

// `type="title"` used to render at the display size by mistake. It now means "a page title"; entry
// titles and the big first-screen headings have their own types. This keeps it where it belongs.
const PAGE_TITLE_SCREENS = new Set([
  'app/(tabs)/groups.tsx',
  'app/badges/[id].tsx',
  'app/clubs/[id].tsx',
  'app/events/[id].tsx',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('type="title" usage', () => {
  it('appears only on page-title screens', () => {
    const root = join(__dirname, '..', '..');
    const offenders = sourceFiles(root)
      .filter((file) => readFileSync(file, 'utf8').includes('type="title"'))
      .map((file) => relative(root, file).split(sep).join('/'))
      .filter((file) => !PAGE_TITLE_SCREENS.has(file));

    expect(offenders).toEqual([]);
  });
});
