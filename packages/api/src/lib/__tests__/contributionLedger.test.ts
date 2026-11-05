import { describe, expect, it } from 'vitest';
import {
  ContributionSchema,
  contributionAttributes,
  createMemoryLedger,
} from '../contributionLedger.js';

const HASH = `0x${'ab'.repeat(32)}` as const;

describe('contribution ledger', () => {
  it('remembers which activities were already counted', async () => {
    const ledger = createMemoryLedger();

    expect(await ledger.has(HASH)).toBe(false);
    const participant = '0x00000000000000000000000000000000000000aa';
    const claim = await ledger.reserve(HASH, participant);
    await ledger.mark(HASH, participant, claim);
    expect(await ledger.has(HASH)).toBe(true);
    expect(await ledger.has(HASH.toUpperCase().replace('0X', '0x') as `0x${string}`)).toBe(true);
  });

  it('treats a reserved activity as taken until its claim is released or the activity is marked', async () => {
    const ledger = createMemoryLedger();
    const participant = '0x00000000000000000000000000000000000000aa';

    const first = await ledger.reserve(HASH, participant);
    expect(await ledger.has(HASH)).toBe(true);
    await ledger.release(first);
    expect(await ledger.has(HASH)).toBe(false);

    const second = await ledger.reserve(HASH, participant);
    await ledger.mark(HASH, participant, second);
    expect(await ledger.has(HASH)).toBe(true);
  });

  it('keys Arkiv entries by the lowercase hash under their own named schema', () => {
    const attributes = contributionAttributes(
      HASH.toUpperCase().replace('0X', '0x') as `0x${string}`
    );

    expect(attributes.activity_hash).toMatchObject({ type: 'str', value: HASH });
    expect(attributes.state).toMatchObject({ type: 'str', value: 'counted' });
    expect(ContributionSchema.name).toBe('season_contribution');
  });
});
