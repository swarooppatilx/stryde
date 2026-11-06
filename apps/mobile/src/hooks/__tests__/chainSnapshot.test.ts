import { beforeEach, describe, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({
  composite: vi.fn(),
  activities: vi.fn(),
  territories: vi.fn(),
  profile: vi.fn(),
}));
vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: {
      ...actual.services,
      subgraph: { ...actual.services.subgraph, getAthleteComposite: shared.composite },
      sync: {
        ...actual.services.sync,
        syncActivitiesFromChain: shared.activities,
        syncTerritoriesFromChain: shared.territories,
        syncProfileFromChain: shared.profile,
      },
    },
  };
});

const { fetchChainSnapshot } = await import('@/hooks/chainSnapshot');

const WALLET = '0x00000000000000000000000000000000000000aa' as const;
const activity = { activityHash: '0x1' };
const territory = {
  id: 't1',
  areaSqm: 10,
  controlStrength: 7,
  capturedAt: 100,
  lastReinforced: 200,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchChainSnapshot', () => {
  it('uses the composed subgraph answer and drops inactive territories', async () => {
    shared.composite.mockResolvedValue({
      activities: [activity],
      territories: [
        { id: 'live', isActive: true },
        { id: 'lost', isActive: false },
      ],
      profileId: 5n,
    });

    const snapshot = await fetchChainSnapshot(WALLET);

    expect(snapshot).toEqual({
      activities: [activity],
      territories: [{ id: 'live', isActive: true }],
      profile: { isRegistered: true, profileId: 5n },
    });
    expect(shared.activities).not.toHaveBeenCalled();
  });

  it('falls back to the registries when the subgraph has nothing', async () => {
    shared.composite.mockResolvedValue(null);
    shared.activities.mockResolvedValue([activity]);
    shared.territories.mockResolvedValue([territory]);
    shared.profile.mockResolvedValue({ isRegistered: true, profileId: 9n });

    const snapshot = await fetchChainSnapshot(WALLET);

    expect(snapshot).toEqual({
      activities: [activity],
      territories: [{ id: 't1', areaSqm: 10, strength: 7, capturedAt: 100, lastReinforced: 200 }],
      profile: { isRegistered: true, profileId: 9n },
    });
  });

  it('falls back to the registries when the subgraph query fails', async () => {
    shared.composite.mockRejectedValue(new Error('down'));
    shared.activities.mockResolvedValue([]);
    shared.territories.mockResolvedValue([]);
    shared.profile.mockResolvedValue({ isRegistered: false, profileId: null });

    const snapshot = await fetchChainSnapshot(WALLET);

    expect(snapshot.territories).toEqual([]);
    expect(shared.activities).toHaveBeenCalledWith(WALLET);
  });

  it('keeps what synced when one registry read fails, and never reads a failed territory list as none', async () => {
    shared.composite.mockResolvedValue(null);
    shared.activities.mockRejectedValue(new Error('a'));
    shared.territories.mockRejectedValue(new Error('t'));
    shared.profile.mockResolvedValue({ isRegistered: true, profileId: 3n });

    const snapshot = await fetchChainSnapshot(WALLET);

    expect(snapshot).toEqual({
      activities: [],
      territories: null,
      profile: { isRegistered: true, profileId: 3n },
    });
  });

  it('reports an unregistered profile when its read fails', async () => {
    shared.composite.mockResolvedValue(null);
    shared.activities.mockResolvedValue([activity]);
    shared.territories.mockResolvedValue([]);
    shared.profile.mockRejectedValue(new Error('p'));

    const snapshot = await fetchChainSnapshot(WALLET);

    expect(snapshot.profile).toEqual({ isRegistered: false, profileId: null });
    expect(snapshot.activities).toEqual([activity]);
  });
});
