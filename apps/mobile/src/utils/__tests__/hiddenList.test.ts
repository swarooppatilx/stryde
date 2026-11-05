import { describe, expect, it } from 'vitest';
import { hiddenList } from '@/utils/hiddenList';

describe('hiddenList', () => {
  it('lists the blocked first, then the muted, each with its kind', () => {
    expect(hiddenList(['0xa', '0xb'], ['0xc'])).toEqual([
      { address: '0xa', kind: 'blocked' },
      { address: '0xb', kind: 'blocked' },
      { address: '0xc', kind: 'muted' },
    ]);
  });

  it('lists an athlete who is both only once, as blocked', () => {
    expect(hiddenList(['0xa'], ['0xa', '0xb'])).toEqual([
      { address: '0xa', kind: 'blocked' },
      { address: '0xb', kind: 'muted' },
    ]);
  });

  it('is empty when nobody is hidden', () => {
    expect(hiddenList([], [])).toEqual([]);
  });
});
