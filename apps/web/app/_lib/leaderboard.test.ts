import { describe, expect, it } from 'vitest';
import { formatArea, formatKm, type SeasonParticipantRow, toRows } from './leaderboard';

const participant = (
  id: string,
  username: string,
  distance: number,
  areas: Array<{ area: string; isActive: boolean }> = [],
  isVerified = false
): SeasonParticipantRow => ({
  totalContribution: String(distance),
  user: { id, username, isVerified, territories: areas },
});

describe('toRows', () => {
  it('ranks athletes by distance, highest first', () => {
    const rows = toRows([
      participant('0xa', 'asha', 5_000),
      participant('0xb', 'dev', 22_000),
      participant('0xc', 'meera', 9_000),
    ]);

    expect(rows.map((r) => [r.rank, r.athlete])).toEqual([
      [1, 'dev'],
      [2, 'meera'],
      [3, 'asha'],
    ]);
  });

  it('adds up only the territory an athlete still holds', () => {
    const [row] = toRows([
      participant('0xa', 'asha', 1000, [
        { area: '1200', isActive: true },
        { area: '800', isActive: false },
        { area: '300', isActive: true },
      ]),
    ]);

    expect(row?.territorySqm).toBe(1500);
  });

  it('shows a short address for an athlete with no name yet', () => {
    const [row] = toRows([participant('0x1234567890abcdef1234567890abcdef12345678', '', 1000)]);

    expect(row?.athlete).toBe('0x1234…5678');
  });

  it('carries the verified flag and a distance in meters', () => {
    const [row] = toRows([participant('0xa', 'asha', 12_345, [], true)]);

    expect(row).toMatchObject({ verified: true, distanceMeters: 12_345 });
  });

  it('is empty when nobody has taken part', () => {
    expect(toRows([])).toEqual([]);
  });
});

describe('formatting', () => {
  it('shows distance in kilometres', () => {
    expect(formatKm(212_400)).toBe('212.4 km');
    expect(formatKm(950)).toBe('0.9 km');
    expect(formatKm(0)).toBe('0 km');
  });

  it('shows small territory in m² and large territory in km²', () => {
    expect(formatArea(0)).toBe('0 m²');
    expect(formatArea(4_500)).toBe('4,500 m²');
    expect(formatArea(1_400_000)).toBe('1.4 km²');
  });
});
