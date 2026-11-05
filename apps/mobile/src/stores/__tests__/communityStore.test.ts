import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

const group = vi.hoisted(() => ({ getAllGroups: vi.fn(), getUserGroups: vi.fn() }));
const event = vi.hoisted(() => ({
  getAllEvents: vi.fn(),
  getUserEvents: vi.fn(),
  isEventRegistryDeployed: vi.fn(() => true),
}));

vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: {
      ...actual.services,
      group: { ...actual.services.group, ...group },
      event: { ...actual.services.event, ...event },
    },
  };
});

installFakePlatform();
const { useCommunityStore } = await import('@/stores/communityStore');

const WALLET = '0x00000000000000000000000000000000000000aa' as const;

const onchainGroup = (id: number) => ({
  id: BigInt(id),
  name: `Club ${id}`,
  location: 'Pune',
  description: '',
  sportType: 0,
  memberCount: 3,
  owner: WALLET,
  createdAt: 1,
  active: true,
});

beforeEach(() => {
  installFakePlatform();
  useCommunityStore.getState().reset();
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('clubs when a refresh fails', () => {
  it('keeps the clubs already loaded and says the refresh failed', async () => {
    group.getAllGroups.mockResolvedValueOnce([onchainGroup(1), onchainGroup(2)]);
    await useCommunityStore.getState().fetchClubs();

    group.getAllGroups.mockRejectedValueOnce(new Error('rpc down'));
    await useCommunityStore.getState().fetchClubs();

    const state = useCommunityStore.getState();
    expect(state.clubs.map((c) => c.name)).toEqual(['Club 1', 'Club 2']);
    expect(state.clubsError).toBe('rpc down');
    expect(state.clubsLoading).toBe(false);
  });

  it('clears the error once a refresh works, and an empty list then really means none', async () => {
    group.getAllGroups.mockRejectedValueOnce(new Error('rpc down'));
    await useCommunityStore.getState().fetchClubs();
    group.getAllGroups.mockResolvedValueOnce([]);
    await useCommunityStore.getState().fetchClubs();

    expect(useCommunityStore.getState().clubsError).toBeNull();
    expect(useCommunityStore.getState().clubs).toEqual([]);
  });

  it('does not forget which clubs you joined', async () => {
    group.getUserGroups.mockResolvedValueOnce([onchainGroup(1)]);
    await useCommunityStore.getState().fetchJoinedClubs(WALLET);

    group.getUserGroups.mockRejectedValueOnce(new Error('rpc down'));
    await useCommunityStore.getState().fetchJoinedClubs(WALLET);

    expect(useCommunityStore.getState().joinedClubIds).toEqual(['1']);
  });
});

describe('events when a refresh fails', () => {
  it('keeps the events already loaded and says the refresh failed', async () => {
    const onchainEvent = {
      id: 1n,
      title: 'October 50K',
      description: '',
      sportType: 0,
      startTime: 1,
      endTime: 2,
      distanceGoal: 50_000,
      participantCount: 1,
      host: WALLET,
      active: true,
    };
    event.getAllEvents.mockResolvedValueOnce([onchainEvent]);
    await useCommunityStore.getState().fetchEvents();

    event.getAllEvents.mockRejectedValueOnce(new Error('rpc down'));
    await useCommunityStore.getState().fetchEvents();

    const state = useCommunityStore.getState();
    expect(state.events.map((e) => e.title)).toEqual(['October 50K']);
    expect(state.eventsError).toBe('rpc down');
  });
});
