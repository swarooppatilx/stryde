import { describe, expect, it } from 'vitest';
import { overflowActionKeys } from '@/utils/activityActions';

describe('overflowActionKeys', () => {
  it('puts delete last, after the safe actions', () => {
    expect(overflowActionKeys({ hasRoute: true, isOwner: true })).toEqual([
      'flyover',
      'copy',
      'download',
      'gpx',
      'delete',
    ]);
  });

  it('offers no flyover, route image or GPX without a route, and no delete to a visitor', () => {
    expect(overflowActionKeys({ hasRoute: false, isOwner: false })).toEqual([]);
    expect(overflowActionKeys({ hasRoute: false, isOwner: true })).toEqual(['delete']);
  });
});
