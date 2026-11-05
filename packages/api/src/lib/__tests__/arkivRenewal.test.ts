import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENEWAL,
  type ExpiringEntity,
  planRenewals,
  type RenewalClient,
  renewalTarget,
  renewExpiring,
} from '../arkivRenewal.js';

/** 180 days of 2 s blocks: the longest round number under Rabdi's 7,884,000-block cap. */
const PERIOD_BLOCKS = 7_776_000n;
const key = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

function fakeClient(entities: ExpiringEntity[], over: Partial<RenewalClient> = {}) {
  const extended: { key: string; target: bigint }[] = [];
  const client: RenewalClient = {
    head: async () => 1_000n,
    expiring: async () => ({ entities, complete: true }),
    extend: async (k, target) => {
      extended.push({ key: k, target });
    },
    ...over,
  };
  return { client, extended };
}

describe('renewalTarget', () => {
  it('reaches a full extension period from now', () => {
    expect(renewalTarget(1_000n, 5_000n, 180)).toBe(1_000n + PERIOD_BLOCKS);
  });
  it('never shortens an entity that already lives longer', () => {
    expect(renewalTarget(1_000n, 1_000n + PERIOD_BLOCKS + 10n, 180)).toBeNull();
  });
  it('asks for nothing the chain would refuse: a lifetime past its 182-day cap', () => {
    expect(renewalTarget(1_000n, 5_000n, 365)).toBeNull();
  });
  it('renews by default for a period the chain accepts', () => {
    expect(DEFAULT_RENEWAL.extendDays).toBeLessThanOrEqual(182);
  });
});

describe('planRenewals', () => {
  it('puts the soonest-expiring first and drops entities that already expired', () => {
    const plan = planRenewals(
      1_000n,
      [
        { key: key(1), expiresAt: 9_000n },
        { key: key(2), expiresAt: 3_000n },
        { key: key(3), expiresAt: 900n },
      ],
      DEFAULT_RENEWAL
    );
    expect(plan.map((p) => p.key)).toEqual([key(2), key(1)]);
  });
});

describe('renewExpiring', () => {
  it('extends what is due and reports counts', async () => {
    const { client, extended } = fakeClient([
      { key: key(1), expiresAt: 4_000n },
      { key: key(2), expiresAt: 5_000n },
    ]);
    const report = await renewExpiring(client);
    expect(extended).toHaveLength(2);
    expect(report).toMatchObject({ found: 2, renewed: 2, failed: 0, more: false });
  });

  it('keeps going after one extension fails', async () => {
    const calls: string[] = [];
    const { client } = fakeClient(
      [
        { key: key(1), expiresAt: 4_000n },
        { key: key(2), expiresAt: 5_000n },
      ],
      {
        extend: async (k) => {
          calls.push(k);
          if (k === key(1)) throw new Error('rpc down');
        },
      }
    );
    const report = await renewExpiring(client);
    expect(calls).toEqual([key(1), key(2)]);
    expect(report).toMatchObject({ renewed: 1, failed: 1 });
  });

  it('caps one run and says more is waiting', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      key: key(i + 1),
      expiresAt: 4_000n + BigInt(i),
    }));
    const { client, extended } = fakeClient(many);
    const report = await renewExpiring(client, { ...DEFAULT_RENEWAL, maxRenewals: 2 });
    expect(extended.map((e) => e.key)).toEqual([key(1), key(2)]);
    expect(report).toMatchObject({ found: 5, renewed: 2, more: true });
  });

  it('flags an incomplete scan as more work', async () => {
    const { client } = fakeClient([], {
      expiring: async () => ({ entities: [], complete: false }),
    });
    expect((await renewExpiring(client)).more).toBe(true);
  });
});
