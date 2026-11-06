import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import type { ChallengeEvent } from '@/types/event';

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
const { useCommunityStore, sportTypeToOnchain } = await import('@/stores/communityStore');
type Club = ReturnType<typeof useCommunityStore.getState>['clubs'][number];

const WALLET = '0x00000000000000000000000000000000000000aa' as const;

const club = (id: string, memberCount = 3): Club => ({
  id,
  name: `Club ${id}`,
  location: '',
  description: '',
  sportType: 'run',
  memberCount,
  owner: WALLET,
  createdAt: 1,
});

const challenge = (id: string, participantCount = 2): ChallengeEvent => ({
  id,
  title: `Event ${id}`,
  startDate: new Date(0),
  endDate: new Date(1000),
  distanceGoal: 5000,
  participantCount,
  sportType: 'run',
  description: '',
  host: WALLET,
});

const onchainEvent = (id: number, sportType: number) => ({
  id: BigInt(id),
  title: `Event ${id}`,
  description: 'd',
  sportType,
  startTime: 100,
  endTime: 200,
  distanceGoal: 5000,
  participantCount: 4,
  host: WALLET,
  active: true,
  startLat: 0,
  startLng: 0,
});

beforeEach(() => {
  installFakePlatform();
  useCommunityStore.getState().reset();
  vi.clearAllMocks();
  event.isEventRegistryDeployed.mockReturnValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('club membership applied locally', () => {
  it('adds a joined club and counts the new member once', () => {
    useCommunityStore.setState({ clubs: [club('1', 3), club('2', 5)] });
    const { applyClubMembership } = useCommunityStore.getState();
    applyClubMembership('1', true);
    applyClubMembership('1', true);

    const state = useCommunityStore.getState();
    expect(state.joinedClubIds).toEqual(['1']);
    expect(state.clubs.map((c) => c.memberCount)).toEqual([4, 5]);
    expect(state.isClubJoined('1')).toBe(true);
    expect(state.isClubJoined('2')).toBe(false);
  });

  it('removes a left club, never takes the count below zero, and ignores leaving a club not joined', () => {
    useCommunityStore.setState({ clubs: [club('1', 0)], joinedClubIds: ['1'] });
    const { applyClubMembership } = useCommunityStore.getState();
    applyClubMembership('1', false);
    expect(useCommunityStore.getState().joinedClubIds).toEqual([]);
    expect(useCommunityStore.getState().clubs[0]?.memberCount).toBe(0);

    const before = useCommunityStore.getState().clubs;
    applyClubMembership('1', false);
    expect(useCommunityStore.getState().clubs).toBe(before);
  });

  it('upserts a club: replaces in place when known, puts a new one first', () => {
    useCommunityStore.setState({ clubs: [club('1'), club('2')] });
    const { upsertClub } = useCommunityStore.getState();
    upsertClub({ ...club('2'), name: 'Renamed' });
    upsertClub(club('3'));
    expect(useCommunityStore.getState().clubs.map((c) => c.name)).toEqual([
      'Club 3',
      'Club 1',
      'Renamed',
    ]);
  });
});

describe('events', () => {
  it('maps onchain events, with multi-sport and an unknown sport falling back to run', async () => {
    const multi = (await import('@repo/shared')).services.event.MULTI_SPORT_TYPE;
    event.getAllEvents.mockResolvedValueOnce([
      onchainEvent(1, multi),
      onchainEvent(2, 9999),
      onchainEvent(3, 1),
    ]);
    await useCommunityStore.getState().fetchEvents();

    const { events, eventsLoading, eventsError } = useCommunityStore.getState();
    expect(events.map((e) => e.id)).toEqual(['1', '2', '3']);
    expect(events[0]?.sportType).toBe('multi');
    expect(events[1]?.sportType).toBe('run');
    expect(events[2]?.sportType).not.toBe('run');
    expect(events[0]?.startDate).toEqual(new Date(100_000));
    expect(events[0]?.endDate).toEqual(new Date(200_000));
    expect(eventsLoading).toBe(false);
    expect(eventsError).toBeNull();
  });

  it('uses a generic message when the failure is not an Error', async () => {
    event.getAllEvents.mockRejectedValueOnce('boom');
    await useCommunityStore.getState().fetchEvents();
    expect(useCommunityStore.getState().eventsError).toBe('Could not load events');

    group.getAllGroups.mockRejectedValueOnce('boom');
    await useCommunityStore.getState().fetchClubs();
    expect(useCommunityStore.getState().clubsError).toBe('Could not load clubs');
  });

  it('loads joined events, skips the call when no registry is deployed, and keeps them on failure', async () => {
    event.getUserEvents.mockResolvedValueOnce([{ id: 7n }, { id: 8n }]);
    await useCommunityStore.getState().fetchJoinedEvents(WALLET);
    expect(useCommunityStore.getState().joinedEvents).toEqual(['7', '8']);

    event.getUserEvents.mockRejectedValueOnce(new Error('rpc down'));
    await useCommunityStore.getState().fetchJoinedEvents(WALLET);
    expect(useCommunityStore.getState().joinedEvents).toEqual(['7', '8']);

    event.isEventRegistryDeployed.mockReturnValue(false);
    event.getUserEvents.mockClear();
    await useCommunityStore.getState().fetchJoinedEvents(WALLET);
    expect(event.getUserEvents).not.toHaveBeenCalled();
  });

  it('applies a join and a leave to the participant count, never below zero', () => {
    useCommunityStore.setState({ events: [challenge('1', 2), challenge('2', 0)] });
    const { applyEventJoin } = useCommunityStore.getState();
    applyEventJoin('1', true);
    applyEventJoin('1', true);
    expect(useCommunityStore.getState().events[0]?.participantCount).toBe(3);
    expect(useCommunityStore.getState().isEventJoined('1')).toBe(true);

    applyEventJoin('1', false);
    expect(useCommunityStore.getState().events[0]?.participantCount).toBe(2);
    expect(useCommunityStore.getState().joinedEvents).toEqual([]);

    useCommunityStore.setState({ joinedEvents: ['2'] });
    applyEventJoin('2', false);
    expect(useCommunityStore.getState().events[1]?.participantCount).toBe(0);
  });

  it('upserts and removes events', () => {
    useCommunityStore.setState({ events: [challenge('1'), challenge('2')] });
    const { upsertEvent, removeEvent } = useCommunityStore.getState();
    upsertEvent({ ...challenge('2'), title: 'Renamed' });
    upsertEvent(challenge('3'));
    expect(useCommunityStore.getState().events.map((e) => e.title)).toEqual([
      'Event 3',
      'Event 1',
      'Renamed',
    ]);
    removeEvent('1');
    expect(useCommunityStore.getState().events.map((e) => e.id)).toEqual(['3', '2']);
  });

  it('knows the host of an event regardless of address casing, and no host for an unknown event', () => {
    useCommunityStore.setState({ events: [challenge('1')] });
    const { isEventHost } = useCommunityStore.getState();
    expect(isEventHost('1', WALLET.toUpperCase().replace('0X', '0x') as `0x${string}`)).toBe(true);
    expect(isEventHost('1', '0x00000000000000000000000000000000000000bb')).toBe(false);
    expect(isEventHost('nope', WALLET)).toBe(false);
    expect(isEventHost('1')).toBe(false);
  });
});

describe('community persistence', () => {
  const migrate = (state: unknown, version: number) =>
    useCommunityStore.persist.getOptions().migrate?.(state, version);

  it('keeps only the joined events when upgrading from before v4', () => {
    expect(migrate({ joinedEvents: ['1'], clubs: [club('1')] }, 3)).toEqual({
      joinedEvents: ['1'],
    });
    expect(migrate({}, 2)).toEqual({ joinedEvents: [] });
  });

  it('leaves current-version state alone', () => {
    const saved = { joinedEvents: ['5'] };
    expect(migrate(saved, 4)).toBe(saved);
  });

  it('saves nothing but the joined events', () => {
    useCommunityStore.setState({ clubs: [club('1')], joinedEvents: ['3'], joinedClubIds: ['1'] });
    const partial = useCommunityStore.persist
      .getOptions()
      .partialize?.(useCommunityStore.getState());
    expect(partial).toEqual({ joinedEvents: ['3'] });
  });
});

describe('sportTypeToOnchain', () => {
  it('gives each activity type its own onchain id', () => {
    expect(sportTypeToOnchain('run')).not.toBe(sportTypeToOnchain('ride'));
    expect(typeof sportTypeToOnchain('run')).toBe('number');
  });
});
