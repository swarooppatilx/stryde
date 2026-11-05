import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import { describeFileImport, IMPORT_COPY } from '@/utils/importMessage';

describe('describeFileImport', () => {
  it('reports imported and skipped', () => {
    expect(describeFileImport({ imported: 3, skipped: 1, failed: 0 })).toBe(
      '3 imported, 1 skipped'
    );
  });

  it('adds what could not be saved', () => {
    expect(describeFileImport({ imported: 0, skipped: 0, failed: 2 })).toBe(
      '0 imported, 0 skipped, 2 could not be saved'
    );
  });

  it('keeps the screen copy free of banned words', () => {
    for (const line of Object.values(IMPORT_COPY)) expect(line).not.toMatch(BANNED_USER_WORDS);
  });
});
