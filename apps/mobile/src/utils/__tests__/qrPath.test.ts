import { describe, expect, it } from 'vitest';
import { qrPath } from '@/utils/qrPath';

describe('qrPath', () => {
  it('draws a unit square for each dark module', () => {
    const data = Uint8Array.from([1, 0, 0, 1]);
    expect(qrPath({ size: 2, data })).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
  });

  it('is empty when nothing is dark', () => {
    expect(qrPath({ size: 2, data: new Uint8Array(4) })).toBe('');
  });
});
