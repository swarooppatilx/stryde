import { describe, expect, it, vi } from 'vitest';
import {
  ensNameProblem,
  findLookAlike,
  isNewCounterparty,
  looksLikeEnsName,
  verifyEnsRoundTrip,
} from '@/utils/counterpartyChecks';

const REAL = '0xAbCd1234567890aBcDef1234567890abCdEf9a8b';
// Same first four and last four hex characters, one in the middle changed.
const FAKE = '0xabcd1234567890abcdef1234567890abcdef9a8b'.replace('7890abcdef', '7890abcdee');
const known = [{ wallet: REAL, username: 'maya' }];

describe('findLookAlike', () => {
  it('warns about an address that starts and ends like a known athlete but differs', () => {
    const found = findLookAlike(FAKE, known);
    expect(found?.athlete).toBe('maya');
    expect(found?.knownWallet).toBe(REAL);
    const differing = found?.typed.filter((s) => s.differs).map((s) => s.text);
    expect(differing).toEqual(['e']);
    expect(found?.known.filter((s) => s.differs).map((s) => s.text)).toEqual(['f']);
  });

  it('keeps every character of the typed address across the segments', () => {
    const found = findLookAlike(FAKE, known);
    expect(found?.typed.map((s) => s.text).join('')).toBe(FAKE);
  });

  it('says nothing for the same address in another letter case', () => {
    expect(findLookAlike(REAL.toLowerCase(), known)).toBeNull();
  });

  it('says nothing when the ends differ', () => {
    const other = `0x1111${FAKE.slice(6)}`;
    expect(findLookAlike(other, known)).toBeNull();
    const otherEnd = `${FAKE.slice(0, -4)}1111`;
    expect(findLookAlike(otherEnd, known)).toBeNull();
  });

  it('ignores text that is not an address', () => {
    expect(findLookAlike('maya.eth', known)).toBeNull();
    expect(findLookAlike('', known)).toBeNull();
  });
});

describe('isNewCounterparty', () => {
  it('is true for an address never seen, false for one seen in any letter case', () => {
    expect(isNewCounterparty(FAKE, [REAL])).toBe(true);
    expect(isNewCounterparty(REAL.toLowerCase(), [REAL])).toBe(false);
    expect(isNewCounterparty(REAL, [])).toBe(true);
  });
});

describe('ensNameProblem', () => {
  it('accepts plain names and emoji', () => {
    expect(ensNameProblem('maya.eth')).toBeNull();
    expect(ensNameProblem('🏃.eth')).toBeNull();
  });

  it('rejects zero-width characters', () => {
    expect(ensNameProblem('ma​ya.eth')).toBe('hidden-characters');
    expect(ensNameProblem('ma﻿ya.eth')).toBe('hidden-characters');
  });

  it('rejects bidi controls', () => {
    expect(ensNameProblem('maya‮.eth')).toBe('hidden-characters');
    expect(ensNameProblem('⁦maya.eth')).toBe('hidden-characters');
  });

  it('rejects a label that mixes latin letters with look-alike letters', () => {
    // Cyrillic "а" in place of the latin one.
    expect(ensNameProblem('mаya.eth')).toBe('mixed-alphabets');
  });

  it('also rejects an accented letter beside plain ones, to stay strict', () => {
    expect(ensNameProblem('m\u00FCnchen.eth')).toBe('mixed-alphabets');
  });

  it('allows a label written wholly in another alphabet', () => {
    expect(ensNameProblem('мая.eth')).toBeNull();
  });
});

describe('looksLikeEnsName', () => {
  it('tells names from addresses and plain text', () => {
    expect(looksLikeEnsName('maya.eth')).toBe(true);
    expect(looksLikeEnsName(' maya.eth ')).toBe(true);
    expect(looksLikeEnsName(REAL)).toBe(false);
    expect(looksLikeEnsName('maya')).toBe(false);
    expect(looksLikeEnsName('may a.eth')).toBe(false);
  });
});

describe('verifyEnsRoundTrip', () => {
  const resolvers = (forward: string | null, reverse: string | null) => ({
    forward: vi.fn(async () => forward as `0x${string}` | null),
    reverse: vi.fn(async () => reverse),
  });

  it('is true only when the name resolves to the address and back', async () => {
    expect(
      await verifyEnsRoundTrip('maya.eth', REAL, resolvers(REAL.toLowerCase(), 'Maya.eth'))
    ).toBe(true);
  });

  it('is false when the name points somewhere else', async () => {
    expect(await verifyEnsRoundTrip('maya.eth', REAL, resolvers(FAKE, 'maya.eth'))).toBe(false);
  });

  it('is false when the address names someone else, or nothing', async () => {
    expect(await verifyEnsRoundTrip('maya.eth', REAL, resolvers(REAL, 'other.eth'))).toBe(false);
    expect(await verifyEnsRoundTrip('maya.eth', REAL, resolvers(REAL, null))).toBe(false);
  });

  it('skips the reverse lookup when the forward one already fails', async () => {
    const r = resolvers(null, 'maya.eth');
    expect(await verifyEnsRoundTrip('maya.eth', REAL, r)).toBe(false);
    expect(r.reverse).not.toHaveBeenCalled();
  });

  it('is false when a lookup throws', async () => {
    const r = { forward: vi.fn().mockRejectedValue(new Error('slow')), reverse: vi.fn() };
    expect(await verifyEnsRoundTrip('maya.eth', REAL, r)).toBe(false);
  });
});
