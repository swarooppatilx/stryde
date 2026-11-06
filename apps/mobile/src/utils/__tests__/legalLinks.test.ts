import { describe, expect, it } from 'vitest';
import { legalLinks } from '@/utils/legalLinks';

describe('legalLinks', () => {
  it('has no rows when no web address is set', () => {
    expect(legalLinks('')).toEqual([]);
    expect(legalLinks('   ')).toEqual([]);
  });

  it('builds Support, Terms and Privacy from the web address', () => {
    expect(legalLinks('https://stryde.app').map((l) => [l.title, l.url])).toEqual([
      ['Support', 'https://stryde.app/support'],
      ['Terms', 'https://stryde.app/terms'],
      ['Privacy', 'https://stryde.app/privacy'],
    ]);
  });

  it('does not double the slash when the address ends with one', () => {
    expect(legalLinks('https://stryde.app/')[0]?.url).toBe('https://stryde.app/support');
  });

  it('ignores an address that is not http or https', () => {
    expect(legalLinks('javascript:alert(1)')).toEqual([]);
  });
});
