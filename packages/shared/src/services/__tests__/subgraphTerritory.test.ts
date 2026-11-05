import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl: 'https://graph.test/q' }) };
});

const { getTerritoriesFromSubgraph } = await import('../subgraphTerritory');

const territory = (id: string, isActive = true) => ({
  id,
  owner: { id: '0x00000000000000000000000000000000000000aa' },
  area: '12345',
  strength: '100',
  capturedAt: '1700000000',
  lastReinforced: '1700000100',
  isActive,
  // TerritoryRegistry stores degrees × 1e6
  minLng: 73_851_074,
  minLat: 18_524_209,
  maxLng: 73_861_074,
  maxLat: 18_534_209,
});

afterEach(() => vi.unstubAllGlobals());

describe('getTerritoriesFromSubgraph', () => {
  it('returns bounds in degrees, not the registry fixed-point integers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { territories: [territory('0x1')] } }),
      }))
    );

    const [first] = (await getTerritoriesFromSubgraph()) ?? [];

    expect(first?.bounds.minLng).toBeCloseTo(73.851074, 6);
    expect(first?.bounds.maxLat).toBeCloseTo(18.534209, 6);
  });

  it('skips territories that are no longer active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { territories: [territory('0x1'), territory('0x2', false)] } }),
      }))
    );

    expect((await getTerritoriesFromSubgraph())?.map((t) => t.id)).toEqual(['0x1']);
  });
});
