import { describe, expect, it } from 'vitest';
import { describeImport } from '@/utils/healthImportMessage';

describe('describeImport', () => {
  it('counts what came in, with the right plural', () => {
    expect(describeImport({ status: 'done', imported: 1, skipped: 0, failed: 0 })).toBe(
      'Imported 1 workout.'
    );
    expect(describeImport({ status: 'done', imported: 3, skipped: 0, failed: 0 })).toBe(
      'Imported 3 workouts.'
    );
  });

  it('says so when there is nothing new, and mentions repeats and failures', () => {
    expect(describeImport({ status: 'done', imported: 0, skipped: 2, failed: 1 })).toBe(
      'No new workouts. 2 already in Stryde. 1 could not be saved; try again.'
    );
  });

  it('explains each way it cannot run', () => {
    expect(describeImport({ status: 'unavailable' })).toMatch(/not available/);
    expect(describeImport({ status: 'update-required' })).toMatch(/Update Health Connect/);
    expect(describeImport({ status: 'no-access' })).toMatch(/Allow Stryde/);
  });
});
