import { describe, expect, it } from 'vitest';
import { opponentFromQuery } from '@/utils/opponentFromQuery';

const ME = '0x00000000000000000000000000000000000000aa';
const ASHA = '0x00000000000000000000000000000000000000bb';
const STRANGER = '0x00000000000000000000000000000000000000cc';
const known = [{ wallet: ASHA, username: 'asha_runs' }];

describe('opponentFromQuery', () => {
  it('offers a typed wallet address that nobody on the list has', () => {
    expect(opponentFromQuery(` ${STRANGER} `, known, ME)).toEqual({
      wallet: STRANGER,
      username: '0x0000…00cc',
    });
  });

  it('offers nothing for text that is not a full address', () => {
    expect(opponentFromQuery('asha', known, ME)).toBeNull();
    expect(opponentFromQuery('0x1234', known, ME)).toBeNull();
    expect(opponentFromQuery('', known, ME)).toBeNull();
  });

  it('does not duplicate someone already on the list, whatever the letter case', () => {
    expect(opponentFromQuery(ASHA.toUpperCase().replace('0X', '0x'), known, ME)).toBeNull();
  });

  it('never offers the athlete themselves', () => {
    expect(opponentFromQuery(ME, known, ME)).toBeNull();
  });
});
