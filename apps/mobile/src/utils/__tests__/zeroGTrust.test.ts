import { describe, expect, it } from 'vitest';
import type { ZeroGReceipt } from '@/services/coachService';
import { formatUsdMicro, isTeeRouted, totalCost, trustChip } from '@/utils/zeroGTrust';

const receipt = (over: Partial<ZeroGReceipt> = {}): ZeroGReceipt => ({
  requestId: 'req_1',
  model: 'glm-5.3',
  costUsdMicro: 1800,
  teeVerified: null,
  trustMode: 'verified',
  provider: null,
  ...over,
});

describe('trustChip', () => {
  it('says TEE only when held to TEE providers but nothing was attested (glm-5.3)', () => {
    expect(trustChip([receipt()])).toEqual({ label: 'TEE only', tone: 'verified' });
    expect(trustChip([receipt({ trustMode: 'private' })])?.label).toBe('TEE only');
  });

  it('says TEE verified when the router attested a call and none failed', () => {
    expect(trustChip([receipt({ teeVerified: true })])).toEqual({
      label: 'TEE verified',
      tone: 'verified',
    });
    // A voice debrief: the transcript was attested, the note was not reported.
    expect(trustChip([receipt({ teeVerified: true }), receipt({ teeVerified: null })])?.label).toBe(
      'TEE verified'
    );
  });

  it('does not claim verification when any attestation failed', () => {
    expect(
      trustChip([receipt({ teeVerified: true }), receipt({ teeVerified: false })])?.label
    ).toBe('TEE only');
    expect(trustChip([receipt({ teeVerified: false })])?.label).toBe('TEE only');
  });

  it('labels a standard-provider fallback honestly, even beside TEE calls', () => {
    expect(trustChip([receipt({ trustMode: 'standard', model: 'minimax-image-01' })])).toEqual({
      label: 'Standard provider, not TEE',
      tone: 'warning',
    });
    expect(
      trustChip([receipt({ teeVerified: true }), receipt({ trustMode: 'standard' })])?.label
    ).toBe('Standard provider, not TEE');
  });

  it('shows nothing for receipts saved before trust fields existed, or none at all', () => {
    expect(trustChip([])).toBeNull();
    expect(trustChip([receipt({ trustMode: null })])).toBeNull();
    const old = { requestId: 'r', model: 'm', costUsdMicro: 5 } as ZeroGReceipt;
    expect(trustChip([old])).toBeNull();
    // One old receipt among TEE ones is not enough to claim the whole result was TEE.
    expect(trustChip([receipt({ teeVerified: true }), old])).toBeNull();
  });
});

describe('isTeeRouted', () => {
  it('is true only for verified and private floors', () => {
    expect(isTeeRouted(receipt({ trustMode: 'verified' }))).toBe(true);
    expect(isTeeRouted(receipt({ trustMode: 'private' }))).toBe(true);
    expect(isTeeRouted(receipt({ trustMode: 'standard' }))).toBe(false);
    expect(isTeeRouted(receipt({ trustMode: null }))).toBe(false);
  });
});

describe('cost', () => {
  it('formats micro-USD', () => {
    expect(formatUsdMicro(1800)).toBe('$0.0018');
    expect(formatUsdMicro(8800)).toBe('$0.0088');
    expect(formatUsdMicro(50)).toBe('<$0.0001');
    expect(formatUsdMicro(0)).toBe('<$0.0001');
    expect(formatUsdMicro(2_500_000)).toBe('$2.5000');
  });

  it('is null for a missing or bad figure', () => {
    expect(formatUsdMicro(null)).toBeNull();
    expect(formatUsdMicro(undefined)).toBeNull();
    expect(formatUsdMicro(Number.NaN)).toBeNull();
    expect(formatUsdMicro(-5)).toBeNull();
  });

  it('adds up the calls that reported a cost', () => {
    expect(totalCost([receipt({ costUsdMicro: 1800 }), receipt({ costUsdMicro: 900 })])).toBe(
      '$0.0027'
    );
    expect(totalCost([receipt({ costUsdMicro: 1800 }), receipt({ costUsdMicro: null })])).toBe(
      '$0.0018'
    );
  });

  it('is null when no call reported a cost', () => {
    expect(totalCost([receipt({ costUsdMicro: null })])).toBeNull();
    expect(totalCost([])).toBeNull();
  });
});
