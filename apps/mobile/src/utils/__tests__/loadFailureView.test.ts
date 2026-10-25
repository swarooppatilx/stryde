import { describe, expect, it } from 'vitest';
import { loadFailureView } from '@/utils/loadFailureView';

describe('loadFailureView', () => {
  it('shows nothing when the load did not fail', () => {
    expect(loadFailureView({ failed: false, hasCached: true })).toBe('none');
    expect(loadFailureView({ failed: false, hasCached: false })).toBe('none');
  });

  it('keeps the cached content and adds a banner when a load fails over it', () => {
    expect(loadFailureView({ failed: true, hasCached: true })).toBe('banner');
  });

  it('replaces the page with the error only when there is nothing to show', () => {
    expect(loadFailureView({ failed: true, hasCached: false })).toBe('error');
  });
});
