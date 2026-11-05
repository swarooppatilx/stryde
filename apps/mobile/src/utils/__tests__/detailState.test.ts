import { describe, expect, it } from 'vitest';
import { detailFallback } from '@/utils/detailState';

describe('detailFallback', () => {
  it('keeps showing the spinner while the list is loading', () => {
    expect(detailFallback({ loading: true, error: null })).toBe('loading');
    // A previous failure must not hide a retry in flight.
    expect(detailFallback({ loading: true, error: 'boom' })).toBe('loading');
  });

  it('says it failed, not that nothing exists, when the request errored', () => {
    expect(detailFallback({ loading: false, error: 'Could not load events' })).toBe('error');
  });

  it('only says "not found" when the load succeeded and the item is not in it', () => {
    expect(detailFallback({ loading: false, error: null })).toBe('missing');
  });
});
