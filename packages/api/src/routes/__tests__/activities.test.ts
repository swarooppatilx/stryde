import { describe, expect, it } from 'vitest';
import { activities, computeActivityHash } from '../activities.js';

describe('computeActivityHash', () => {
  // Pinned against packages/shared/src/services/activity.ts#computeActivityHash
  // (same `${polyline}:${territoryArea}:${metadata}` + keccak256(toBytes(...))
  // construction, verified to produce identical output for these inputs). If
  // this ever fails, this copy has drifted from the client-side one that
  // ActivityRegistry.recordActivity actually signs against — go re-sync it
  // rather than update the fixture.
  const fixtures: Array<[string, number, string, `0x${string}`]> = [
    [
      'polyline123',
      1000,
      'metadata',
      '0xe769dfc48f2569bdf0a487a7b92b3045a0c2d925ca95f0d8fa19976da5aebe20',
    ],
    ['abc', 42.5, '', '0xd252d15c110446efce873a919f100cd21afe4913fb6923c4ff5275077b267111'],
  ];

  it('matches the canonical client-side hash construction', () => {
    for (const [polyline, territoryArea, metadata, expected] of fixtures) {
      expect(computeActivityHash(polyline, territoryArea, metadata)).toBe(expected);
    }
  });

  it('returns a 0x-prefixed 32-byte hash', () => {
    const hash = computeActivityHash('polyline123', 1000, 'metadata');
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe('POST /validate', () => {
  const validBody = {
    polyline: 'polyline123',
    territoryArea: 1000,
    metadata: 'activity-id-123',
    distance: 5000,
    duration: 1800,
  };

  it('returns a real computed hash on valid input', async () => {
    const res = await activities.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      valid: true,
      hash: computeActivityHash(validBody.polyline, validBody.territoryArea, validBody.metadata),
    });
    expect(json.hash).not.toBe('0x...');
  });

  it('rejects a missing polyline', async () => {
    const res = await activities.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, polyline: undefined }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  it('rejects a negative distance', async () => {
    const res = await activities.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, distance: -5 }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  it('rejects an absurd duration', async () => {
    const res = await activities.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, duration: 999_999_999 }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  it('rejects malformed JSON without crashing', async () => {
    const res = await activities.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });
});
