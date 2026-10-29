import { describe, expect, it } from 'vitest';
import type { Activity, Gear } from '@/types';
import { buildDataExport } from '@/utils/dataExport';
import { DEFAULT_SETTINGS } from '@/utils/profile';

const activity = {
  id: 'a1',
  userId: '0xme',
  name: 'Morning Run',
  activityType: 'run',
  distance: 5000,
  duration: 1_500_000,
  polyline: 'abc',
  territory: null,
  territoryArea: 0,
  createdAt: new Date('2026-10-20T06:00:00Z'),
  gearId: 'g1',
  txHash: '0xhash',
  images: ['file:///data/local.jpg', 'https://gateway.example/ipfs/photo'],
} as Activity;

const gear: Gear[] = [{ id: 'g1', name: 'Daily trainers', kind: 'shoes', startingDistance: 0 }];

const input = {
  profile: {
    username: 'asha',
    firstName: 'Asha',
    lastName: 'R',
    gender: 'woman' as const,
    birthday: '1990-04-02',
    wallet: '0x0000000000000000000000000000000000000001',
    settings: { ...DEFAULT_SETTINGS, weightKg: 62 },
  },
  activities: [activity],
  gear,
  now: new Date('2026-10-21T10:00:00Z'),
};

describe('buildDataExport', () => {
  it('carries the athlete, their activities and gear, dated and versioned', () => {
    const data = JSON.parse(buildDataExport(input));

    expect(data.version).toBe(1);
    expect(data.exportedAt).toBe('2026-10-21T10:00:00.000Z');
    expect(data.athlete).toMatchObject({ username: 'asha', weightKg: 62, units: 'metric' });
    expect(data.gear).toEqual(gear);
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0]).toMatchObject({
      id: 'a1',
      name: 'Morning Run',
      type: 'run',
      startedAt: '2026-10-20T06:00:00.000Z',
      distanceMeters: 5000,
      durationMs: 1_500_000,
      gearId: 'g1',
      transaction: '0xhash',
    });
  });

  it('keeps only published photo links, not paths on this phone', () => {
    const data = JSON.parse(buildDataExport(input));

    expect(data.activities[0].photos).toEqual(['https://gateway.example/ipfs/photo']);
  });

  it('leaves out anything secret: no private user id, tokens or keys', () => {
    const text = buildDataExport({
      ...input,
      profile: { ...input.profile, privyUserId: 'did:privy:secret' } as typeof input.profile,
    });

    expect(text).not.toContain('did:privy:secret');
    expect(text).not.toMatch(/privateKey|token|secret/i);
  });
});
