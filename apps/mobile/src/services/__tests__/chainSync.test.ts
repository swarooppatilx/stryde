import { describe, expect, it } from 'vitest';
import { at } from '@/platform/fakes';
import { type ChainActivity, mergeChainActivities } from '@/services/chainSync';
import type { Activity } from '@/types';

const hash = (n: number) => `0x${String(n).repeat(64)}`.slice(0, 66);

function chainActivity(n: number, overrides: Partial<ChainActivity> = {}): ChainActivity {
  return {
    activityHash: hash(n),
    owner: '0xowner',
    activityId: BigInt(100 + n),
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    territoryArea: 0,
    timestamp: 1_767_268_800,
    metadata: `meta-${n}`,
    ...overrides,
  };
}

function localActivity(n: number, overrides: Partial<Activity> = {}): Activity {
  return {
    id: `local-${n}`,
    userId: '0xowner',
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    activityHash: hash(n),
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('mergeChainActivities', () => {
  it('keeps what only this device knows about an activity the chain also has', () => {
    const local = localActivity(1, {
      privacy: 'followers',
      feel: 'good',
      strdEarned: 5,
      isManual: true,
      onchainActivityId: '101',
    });

    const merged = at(mergeChainActivities([local], [chainActivity(1)]), 0);

    // a followers-only run must not become public just because a sync ran
    expect(merged).toMatchObject({
      privacy: 'followers',
      feel: 'good',
      strdEarned: 5,
      isManual: true,
      onchainActivityId: '101',
    });
  });

  it('keeps the local id so everything that points at the activity still works', () => {
    const merged = at(mergeChainActivities([localActivity(1)], [chainActivity(1)]), 0);

    expect(merged.id).toBe('local-1');
  });

  it('builds an activity from the chain alone on a fresh install, including its onchain id', () => {
    const merged = at(
      mergeChainActivities(
        [],
        [chainActivity(2, { metadataName: 'Hill repeats', metadataPhotos: ['https://p/1.jpg'] })]
      ),
      0
    );

    expect(merged).toMatchObject({
      id: hash(2),
      userId: '0xowner',
      name: 'Hill repeats',
      distance: 5000,
      onchainActivityId: '102',
      images: ['https://p/1.jpg'],
      image: 'https://p/1.jpg',
    });
    expect(merged.createdAt).toEqual(new Date(1_767_268_800 * 1000));
  });

  it('prefers what the user wrote locally and uses the chain only to fill blanks', () => {
    const local = localActivity(1, { name: 'My name', description: undefined });

    const merged = at(
      mergeChainActivities(
        [local],
        [chainActivity(1, { metadataName: 'Chain name', metadataDescription: 'From IPFS' })]
      ),
      0
    );

    expect(merged.name).toBe('My name');
    expect(merged.description).toBe('From IPFS');
  });

  it('keeps activities that have not reached the chain yet, after the synced ones', () => {
    const pending = localActivity(9, { activityHash: undefined, id: 'pending' });

    const result = mergeChainActivities([pending, localActivity(1)], [chainActivity(1)]);

    expect(result.map((a) => a.id)).toEqual(['local-1', 'pending']);
  });

  it('never lists an activity twice', () => {
    const result = mergeChainActivities(
      [localActivity(1), localActivity(2)],
      [chainActivity(1), chainActivity(2)]
    );

    expect(result).toHaveLength(2);
  });

  it('leaves local activities alone when the chain has none', () => {
    const local = [localActivity(1), localActivity(2)];

    expect(mergeChainActivities(local, [])).toEqual(local);
  });
});

describe('mergeChainActivities and deleted activities', () => {
  it('does not bring back an activity the user deleted from this device', () => {
    const merged = mergeChainActivities(
      [],
      [chainActivity(1), chainActivity(2)],
      new Set([hash(1)])
    );

    expect(merged.map((a) => a.activityHash)).toEqual([hash(2)]);
  });

  it('matches deleted hashes regardless of case', () => {
    const merged = mergeChainActivities(
      [],
      [chainActivity(1)],
      new Set([hash(1).toUpperCase().replace('0X', '0x')])
    );

    expect(merged).toEqual([]);
  });
});
