import { describe, expect, it } from 'vitest';
import { rankByDistance, rankClubMembers } from '@/utils/clubRanking';

const NOW = new Date('2026-10-23T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';

describe('rankClubMembers', () => {
  it('ranks members by the distance they covered in the window, furthest first', () => {
    const rows = rankClubMembers(
      [A, B],
      [
        { userId: A, distance: 5000, createdAt: day(2) },
        { userId: B, distance: 8000, createdAt: day(3) },
        { userId: A, distance: 4000, createdAt: day(5) },
      ],
      NOW,
      30
    );

    expect(rows).toEqual([
      { userId: A, distance: 9000, count: 2 },
      { userId: B, distance: 8000, count: 1 },
    ]);
  });

  it('ignores people who are not members, and anything older than the window', () => {
    const rows = rankClubMembers(
      [A],
      [
        { userId: C, distance: 20_000, createdAt: day(1) },
        { userId: A, distance: 3000, createdAt: day(40) },
        { userId: A, distance: 1000, createdAt: day(1) },
      ],
      NOW,
      30
    );

    expect(rows).toEqual([{ userId: A, distance: 1000, count: 1 }]);
  });

  it('leaves out members who have not been out, and matches wallets whatever their casing', () => {
    const rows = rankClubMembers(
      [A, B],
      [{ userId: A.toUpperCase().replace('0X', '0x'), distance: 2000, createdAt: day(1) }],
      NOW,
      30
    );

    expect(rows.map((r) => r.userId)).toEqual([A]);
  });

  it('breaks ties by who has more activities, then by wallet, so the order is steady', () => {
    const rows = rankClubMembers(
      [B, A],
      [
        { userId: A, distance: 1000, createdAt: day(1) },
        { userId: B, distance: 500, createdAt: day(1) },
        { userId: B, distance: 500, createdAt: day(2) },
      ],
      NOW,
      30
    );

    expect(rows.map((r) => r.userId)).toEqual([B, A]);
  });
});

describe('rankByDistance', () => {
  const since = new Date('2026-10-25T00:00:00Z');
  const at = (iso: string) => new Date(iso);

  it('ranks every athlete out since the start, summing their activities', () => {
    const rows = rankByDistance(
      [
        { userId: '0xA', distance: 3000, createdAt: at('2026-10-26T07:00:00Z') },
        { userId: '0xb', distance: 5000, createdAt: at('2026-10-27T07:00:00Z') },
        { userId: '0xa', distance: 4000, createdAt: at('2026-10-28T07:00:00Z') },
      ],
      since
    );

    expect(rows).toEqual([
      { userId: '0xa', distance: 7000, count: 2 },
      { userId: '0xb', distance: 5000, count: 1 },
    ]);
  });

  it('leaves out activities from before the start', () => {
    const rows = rankByDistance(
      [{ userId: '0xa', distance: 9000, createdAt: at('2026-10-24T23:59:00Z') }],
      since
    );

    expect(rows).toEqual([]);
  });

  it('counts an activity that starts exactly at the boundary', () => {
    const rows = rankByDistance([{ userId: '0xa', distance: 1000, createdAt: since }], since);

    expect(rows).toHaveLength(1);
  });
});
