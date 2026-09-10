import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ring } from '@/types';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const { useTerritoryStore } = await import('../territoryStore');
const { services } = await import('@repo/shared');

// A tiny real ring so `territoryService.getPolygonArea` (used for local-only
// polygons) has real, non-zero geometry to sum.
const RING_A: Ring = [
  [0, 0],
  [0, 0.001],
  [0.001, 0.001],
  [0.001, 0],
  [0, 0],
];
const RING_B: Ring = [
  [10, 10],
  [10, 10.002],
  [10.002, 10.002],
  [10.002, 10],
  [10, 10],
];

const OWNER = '0xowner';

describe('territoryStore getTotalArea', () => {
  beforeEach(() => {
    useTerritoryStore.setState({ polygons: {}, territoryMetadata: {} });
  });

  it('returns 0 when the user has no local or chain-synced territory', () => {
    expect(useTerritoryStore.getState().getTotalArea(OWNER)).toBe(0);
  });

  it('sums locally-captured polygons when there is no chain data yet', () => {
    const { capturePolygon, getTotalArea } = useTerritoryStore.getState();
    capturePolygon(OWNER, RING_A);
    expect(getTotalArea(OWNER)).toBeGreaterThan(0);
  });

  // This is the fresh-install / new-device regression case: the app has
  // never called capturePolygon() locally (polygons[owner] is empty), but
  // useChainSync already synced territories the wallet owns on-chain into
  // territoryMetadata. Before the fix, getTotalArea ignored territoryMetadata
  // entirely and returned 0 here, which meant area-based achievements (and
  // the NFT mint safety-net gated on them) could never unlock for a user who
  // only ever set up a new device/reinstall.
  it('includes chain-synced territory area on a fresh install with no local polygons', () => {
    const { setTerritories, getTotalArea } = useTerritoryStore.getState();
    setTerritories(OWNER, [
      {
        id: '0xterritory1',
        areaSqm: 500,
        strength: 100,
        capturedAt: 1,
        lastReinforced: 1,
      },
    ]);

    expect(useTerritoryStore.getState().polygons[OWNER] ?? []).toHaveLength(0);
    expect(getTotalArea(OWNER)).toBe(500);
  });

  it('does not double-count a polygon captured locally and later confirmed on-chain', () => {
    const { capturePolygon, setTerritories, getTotalArea } = useTerritoryStore.getState();
    capturePolygon(OWNER, RING_A);
    const localArea = getTotalArea(OWNER);
    expect(localArea).toBeGreaterThan(0);

    // The chain territory id is the polygon hash, computed the same way the
    // real claimTerritory() flow computes it from the exact same ring.
    const chainId = services.territory.computePolygonHash(RING_A);
    setTerritories(OWNER, [
      {
        id: chainId,
        // Slightly different from the locally-computed area (e.g. rounding
        // on-chain) to prove we use the chain value, not double count it.
        areaSqm: localArea + 1,
        strength: 100,
        capturedAt: 1,
        lastReinforced: 1,
      },
    ]);

    // Total should equal the chain-reported area for that one territory, not
    // chain area + local area for the same physical polygon.
    expect(getTotalArea(OWNER)).toBe(localArea + 1);
  });

  it('adds chain-synced territory on top of a genuinely separate local-only polygon', () => {
    const { capturePolygon, setTerritories, getTotalArea } = useTerritoryStore.getState();
    capturePolygon(OWNER, RING_A);
    const localArea = getTotalArea(OWNER);

    setTerritories(OWNER, [
      {
        id: '0xsomeOtherTerritory',
        areaSqm: 500,
        strength: 100,
        capturedAt: 1,
        lastReinforced: 1,
      },
    ]);

    expect(getTotalArea(OWNER)).toBe(localArea + 500);
  });

  it('scopes chain-synced territory to the requesting owner', () => {
    const { setTerritories, getTotalArea } = useTerritoryStore.getState();
    setTerritories(OWNER, [
      { id: '0xa', areaSqm: 500, strength: 100, capturedAt: 1, lastReinforced: 1 },
    ]);
    setTerritories('0xotherOwner', [
      { id: '0xb', areaSqm: 999, strength: 100, capturedAt: 1, lastReinforced: 1 },
    ]);

    expect(getTotalArea(OWNER)).toBe(500);
    expect(getTotalArea('0xotherOwner')).toBe(999);
  });

  it('does not mutate unrelated polygons when adding a second local capture', () => {
    const { capturePolygon, getTotalArea } = useTerritoryStore.getState();
    capturePolygon(OWNER, RING_A);
    const afterFirst = getTotalArea(OWNER);
    capturePolygon(OWNER, RING_B);
    const afterSecond = getTotalArea(OWNER);
    expect(afterSecond).toBeGreaterThan(afterFirst);
  });
});
