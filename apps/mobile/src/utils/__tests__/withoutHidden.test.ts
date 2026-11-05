import { describe, expect, it } from 'vitest';
import { withoutHidden } from '@/utils/withoutHidden';

describe('withoutHidden', () => {
  const items = [{ by: '0xA' }, { by: '0xB' }, { by: '0xc' }];

  it('drops items by hidden authors, whatever the casing', () => {
    expect(withoutHidden(items, (i) => i.by, new Set(['0xa', '0xc']))).toEqual([{ by: '0xB' }]);
  });

  it('returns the same list when nobody is hidden', () => {
    expect(withoutHidden(items, (i) => i.by, new Set())).toBe(items);
  });
});
