import { describe, expect, it } from 'vitest';
import { evtId, toMirrorEvent } from '../mirrorEvents.js';

const WALLET = '0x00000000000000000000000000000000000000aa';
const ZERO = '0x0000000000000000000000000000000000000000';

describe('evtId', () => {
  it('sorts as text in the same order as the chain: block first, then log index', () => {
    const ids = [
      evtId(12_069_715n, 3),
      evtId(12_069_715n, 10),
      evtId(99n, 0),
      evtId(12_069_716n, 0),
    ];
    expect([...ids].sort()).toEqual([
      evtId(99n, 0),
      evtId(12_069_715n, 3),
      evtId(12_069_715n, 10),
      evtId(12_069_716n, 0),
    ]);
  });

  it('fits in an Arkiv string column (128 bytes)', () => {
    expect(evtId(2n ** 63n, 99_999).length).toBeLessThanOrEqual(128);
  });
});

describe('toMirrorEvent', () => {
  it('files an activity under its owner and activity id, with every argument kept as text', () => {
    const event = toMirrorEvent(
      'ActivityRecorded',
      { activityId: 1n, owner: WALLET, distance: 1200n, timestamp: 1_793_000_000n },
      100n,
      2
    );

    expect(event).toMatchObject({ kind: 'ActivityRecorded', who: WALLET, ref: '1', block: 100n });
    expect(event?.data).toEqual({
      activityId: '1',
      owner: WALLET,
      distance: '1200',
      timestamp: '1793000000',
    });
    expect(event?.evt).toBe(evtId(100n, 2));
  });

  it('files membership, contribution, achievement and territory events under the right wallet and reference', () => {
    expect(
      toMirrorEvent('GroupJoined', { groupId: 7n, member: WALLET, memberCount: 2n }, 1n, 0)
    ).toMatchObject({ who: WALLET, ref: '7' });
    expect(
      toMirrorEvent(
        'ContributionRecorded',
        { seasonId: 3n, participant: WALLET, contribution: 5n, total: 9n },
        1n,
        0
      )
    ).toMatchObject({ who: WALLET, ref: '3' });
    expect(
      toMirrorEvent(
        'AchievementMinted',
        { tokenId: 4n, recipient: WALLET, achievementId: '0xab' },
        1n,
        0
      )
    ).toMatchObject({ who: WALLET, ref: '0xab' });
    expect(
      toMirrorEvent('TerritoryClaimed', { territoryId: '0x01', controller: WALLET }, 1n, 0)
    ).toMatchObject({ who: WALLET, ref: '0x01' });
  });

  it('uses the zero address when an event names no wallet, so the column is never empty', () => {
    expect(
      toMirrorEvent('SeasonStarted', { seasonId: 3n, startTime: 1n, endTime: 2n }, 1n, 0)
    ).toMatchObject({ who: ZERO, ref: '3' });
  });

  it('lower-cases wallets so reads match however the caller spells them', () => {
    const mixed = '0x00000000000000000000000000000000000000AB';
    expect(toMirrorEvent('GroupJoined', { groupId: 1n, member: mixed }, 1n, 0)?.who).toBe(
      mixed.toLowerCase()
    );
  });

  it('ignores an event it does not mirror', () => {
    expect(toMirrorEvent('Transfer', { from: WALLET }, 1n, 0)).toBeNull();
  });
});
