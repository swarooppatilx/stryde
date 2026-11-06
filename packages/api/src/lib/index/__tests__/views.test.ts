import { describe, expect, it } from 'vitest';
import type { StoredEvent } from '../mirror.js';
import {
  achievementCounts,
  activitiesView,
  contributionTotals,
  groupMembers,
  profilesView,
  territoriesView,
} from '../views.js';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
let seq = 0;
const ev = (
  kind: string,
  who: string,
  ref: string,
  data: Record<string, string> = {},
  block = ++seq
): StoredEvent => ({
  kind,
  evt: `${String(block).padStart(13, '0')}-00000`,
  block: BigInt(block),
  ts: 1_790_000_000 + block,
  who: who as never,
  ref,
  data,
});

describe('profilesView', () => {
  it('builds a profile from its creation and applies the newest rename, avatar and verification', () => {
    const rows = profilesView([
      ev('ProfileCreated', A, '1', { username: 'aadhira', profileId: '1' }),
      ev('AvatarUpdated', A, A, { cid: 'bafy1' }),
      ev('ProfileUpdated', '0x0000000000000000000000000000000000000000', '1', {
        username: 'aadhira_rides',
        profileId: '1',
      }),
      ev('AvatarUpdated', A, A, { cid: 'bafy2' }),
      ev('ProfileVerified', A, A),
    ]);

    expect(rows).toEqual([
      {
        wallet: A,
        profileId: '1',
        username: 'aadhira_rides',
        isVerified: true,
        avatarCid: 'bafy2',
      },
    ]);
  });

  it('lists an unverified profile without an avatar as such', () => {
    expect(
      profilesView([ev('ProfileCreated', B, '2', { username: 'kavya', profileId: '2' })])
    ).toEqual([
      { wallet: B, profileId: '2', username: 'kavya', isVerified: false, avatarCid: null },
    ]);
  });
});

describe('contributionTotals', () => {
  it('takes each athlete’s newest running total for the season', () => {
    const totals = contributionTotals(
      [
        ev('ContributionRecorded', A, '1', { total: '1000' }),
        ev('ContributionRecorded', B, '1', { total: '400' }),
        ev('ContributionRecorded', A, '1', { total: '2500' }),
      ],
      '1'
    );

    expect(Object.fromEntries(totals)).toEqual({ [A]: 2500, [B]: 400 });
  });

  it('ignores other seasons', () => {
    expect(contributionTotals([ev('ContributionRecorded', A, '2', { total: '9' })], '1').size).toBe(
      0
    );
  });
});

describe('achievementCounts', () => {
  it('counts each achievement an athlete holds once', () => {
    const counts = achievementCounts([
      ev('AchievementMinted', A, '0xaa'),
      ev('AchievementMinted', A, '0xbb'),
      ev('AchievementMinted', A, '0xaa'),
      ev('AchievementMinted', B, '0xaa'),
    ]);

    expect(Object.fromEntries(counts)).toEqual({ [A]: 2, [B]: 1 });
  });
});

describe('groupMembers', () => {
  it('lists who joined and has not left, in the order they joined', () => {
    const members = groupMembers([
      ev('GroupCreated', A, '1'),
      ev('GroupJoined', A, '1'),
      ev('GroupJoined', B, '1'),
      ev('GroupLeft', A, '1'),
      ev('GroupJoined', A, '1'),
    ]);

    expect(members).toEqual([B, A]);
  });

  it('counts the creator as a member from the moment the club exists: the contract adds them without a join event', () => {
    expect(groupMembers([ev('GroupCreated', A, '1'), ev('GroupJoined', B, '1')])).toEqual([A, B]);
  });

  it('empties a club that was dissolved', () => {
    expect(groupMembers([ev('GroupJoined', A, '1'), ev('GroupDissolved', A, '1')])).toEqual([]);
  });
});

describe('territoriesView', () => {
  const claim = (id: string, who: string, area: string, block?: number) =>
    ev(
      'TerritoryClaimed',
      who,
      id,
      {
        areaSqm: area,
        strength: '100',
        capturedAt: '5',
        minLng: '73850000',
        minLat: '18520000',
        maxLng: '73860000',
        maxLat: '18530000',
      },
      block
    );

  it('shows who holds each territory now, with its bounds in degrees', () => {
    const rows = territoriesView([claim('0x01', A, '1500')]);

    expect(rows).toEqual([
      {
        id: '0x01',
        owner: A,
        areaSqm: 1500,
        strength: 100,
        capturedAt: 5,
        lastReinforced: 5,
        isActive: true,
        bounds: { minLng: 73.85, minLat: 18.52, maxLng: 73.86, maxLat: 18.53 },
      },
    ]);
  });

  it('passes a territory to whoever claimed it last', () => {
    const rows = territoriesView([claim('0x01', A, '1500'), claim('0x01', B, '1500')]);

    expect(rows.map((r) => r.owner)).toEqual([B]);
  });

  it('marks a territory lost and keeps the strength a reinforcement gave it', () => {
    const lost = territoriesView([
      claim('0x01', A, '1500'),
      ev('TerritoryLost', A, '0x01', { lostAt: '9' }),
    ]);
    expect(lost[0]?.isActive).toBe(false);

    const reinforced = territoriesView([
      claim('0x01', A, '1500'),
      ev('TerritoryReinforced', A, '0x01', { reinforcedAt: '8', strength: '180' }),
    ]);
    expect(reinforced[0]).toMatchObject({ isActive: true, strength: 180, lastReinforced: 8 });
  });
});

describe('activitiesView', () => {
  it('joins each activity with the newest metadata pointer for it', () => {
    const rows = activitiesView([
      ev('ActivityRecorded', A, '1', {
        activityId: '1',
        owner: A,
        activityHash: '0xh1',
        activityType: '0',
        distance: '5000',
        duration: '1680',
        timestamp: '1790000100',
        territoryArea: '0',
      }),
      ev('ActivityMetadataUpdated', A, '1', { activityId: '1', metadataCid: 'bafy-old' }),
      ev('ActivityMetadataUpdated', A, '1', { activityId: '1', metadataCid: 'bafy-new' }),
    ]);

    expect(rows).toEqual([
      {
        activityId: '1',
        user: A,
        activityHash: '0xh1',
        activityType: 0,
        distance: 5000,
        duration: 1680,
        timestamp: 1_790_000_100,
        territoryArea: 0,
        metadataCid: 'bafy-new',
      },
    ]);
  });

  it('has no metadata pointer for an activity nobody described', () => {
    const rows = activitiesView([
      ev('ActivityRecorded', A, '2', {
        activityId: '2',
        owner: A,
        activityHash: '0xh2',
        activityType: '1',
        distance: '100',
        duration: '60',
        timestamp: '1',
        territoryArea: '0',
      }),
    ]);
    expect(rows[0]?.metadataCid).toBeNull();
  });
});
