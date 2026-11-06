import { describe, expect, it } from 'vitest';
import { saveButtonLabel } from '@/utils/savePhase';

describe('saveButtonLabel', () => {
  it('says Save activity while idle', () => {
    expect(saveButtonLabel(false, undefined)).toBe('Save activity');
  });

  it('says Saving… as soon as saving starts, before any phase is known', () => {
    expect(saveButtonLabel(true, undefined)).toBe('Saving…');
  });

  it('names the photo upload, then goes back to Saving…', () => {
    expect(saveButtonLabel(true, 'uploading-photos')).toBe('Uploading photos…');
    expect(saveButtonLabel(true, 'saving')).toBe('Saving…');
  });

  it('ignores a stale phase once saving has ended', () => {
    expect(saveButtonLabel(false, 'uploading-photos')).toBe('Save activity');
  });
});
