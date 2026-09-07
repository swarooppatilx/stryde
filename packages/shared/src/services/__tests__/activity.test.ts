import { describe, expect, it } from 'vitest';
import { computeActivityHash } from '../activity';

describe('computeActivityHash', () => {
  it('returns a 0x-prefixed hash', () => {
    const hash = computeActivityHash('polyline123', 1000, 'metadata');
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('produces consistent hashes for same inputs', () => {
    const hash1 = computeActivityHash('polyline123', 1000, 'metadata');
    const hash2 = computeActivityHash('polyline123', 1000, 'metadata');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeActivityHash('polyline123', 1000, 'metadata');
    const hash2 = computeActivityHash('polyline456', 1000, 'metadata');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different territory areas', () => {
    const hash1 = computeActivityHash('polyline123', 1000, 'metadata');
    const hash2 = computeActivityHash('polyline123', 2000, 'metadata');
    expect(hash1).not.toBe(hash2);
  });
});
