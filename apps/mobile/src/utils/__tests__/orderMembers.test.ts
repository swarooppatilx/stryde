import { describe, expect, it } from 'vitest';
import { orderMembers } from '@/utils/orderMembers';

describe('orderMembers', () => {
  it('puts the owner first and keeps everyone else in the order given', () => {
    expect(orderMembers(['0xb', '0xa', '0xc'], '0xC')).toEqual(['0xc', '0xb', '0xa']);
  });

  it('lists each wallet once, whatever its casing', () => {
    expect(orderMembers(['0xAB', '0xab', '0xcd'], '0xzz')).toEqual(['0xab', '0xcd']);
  });

  it('works when the owner is not among the members', () => {
    expect(orderMembers(['0xa'], '0xb')).toEqual(['0xa']);
  });
});
