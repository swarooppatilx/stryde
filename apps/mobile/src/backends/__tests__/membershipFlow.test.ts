import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

/**
 * Joining a club is the app's typical optimistic write: the screen answers at once, the outbox delivers
 * later, and a refusal has to put the screen back. These run the real outbox, handlers, wiring and
 * community store; only the chain is faked, so what is asserted is what the athlete would see.
 */

const chain = vi.hoisted(() => ({
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
}));
vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: {
      ...actual.services,
      group: { ...actual.services.group, joinGroup: chain.joinGroup, leaveGroup: chain.leaveGroup },
      event: { ...actual.services.event, joinEvent: chain.joinEvent, leaveEvent: chain.leaveEvent },
    },
  };
});
const network = vi.hoisted(() => ({ online: true }));
vi.mock('@/services/onlineStatus', () => ({
  onlineStatus: { getSnapshot: () => network.online, subscribe: () => () => {} },
}));
vi.mock('@/services/wallet', () => ({ getActiveWallet: () => ({}) as never }));
vi.mock('@/utils/toast', () => ({ Toast: { fail: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const { registerMembershipIntents, setClubMember, setEventMember } = await import(
  '@/backends/membership'
);
const { getOutbox, resetOutbox } = await import('@/backends/outbox/appOutbox');
const { useCommunityStore } = await import('@/stores/communityStore');
const { Toast } = await import('@/utils/toast');

const club = (id: string, memberCount = 3) =>
  ({ id, name: `Club ${id}`, memberCount, sportType: 'run' }) as never;
const revert = (errorName: string) =>
  Object.assign(new Error(errorName), {
    name: 'ContractFunctionRevertedError',
    data: { errorName },
  });

beforeEach(() => {
  installFakePlatform();
  resetOutbox();
  vi.clearAllMocks();
  network.online = true;
  registerMembershipIntents();
  useCommunityStore.setState({
    clubs: [club('7'), club('8')],
    joinedClubIds: [],
    events: [],
    joinedEvents: [],
  });
  chain.joinGroup.mockResolvedValue({ confirmed: true });
  chain.leaveGroup.mockResolvedValue({ confirmed: true });
  chain.joinEvent.mockResolvedValue({ confirmed: true });
  chain.leaveEvent.mockResolvedValue({ confirmed: true });
});

const memberCountOf = (id: string) =>
  useCommunityStore.getState().clubs.find((c) => c.id === id)?.memberCount;

describe('joining a club', () => {
  it('shows the athlete as a member at once, before anything reaches the chain', async () => {
    chain.joinGroup.mockReturnValue(new Promise(() => {})); // the chain never answers

    await setClubMember('7', true);

    expect(useCommunityStore.getState().joinedClubIds).toContain('7');
    expect(memberCountOf('7')).toBe(4);
  });

  it('delivers the join once and keeps the screen as it is', async () => {
    await setClubMember('7', true);
    await getOutbox().drain();

    expect(chain.joinGroup).toHaveBeenCalledTimes(1);
    expect(chain.joinGroup).toHaveBeenCalledWith(expect.anything(), 7n);
    expect(useCommunityStore.getState().joinedClubIds).toEqual(['7']);
    expect(getOutbox().entries()).toHaveLength(0);
  });

  it('puts the screen back, with a message, when the contract refuses for good', async () => {
    chain.joinGroup.mockRejectedValue(revert('GroupDissolved'));

    await setClubMember('7', true);
    await getOutbox().drain();

    expect(useCommunityStore.getState().joinedClubIds).toEqual([]);
    expect(memberCountOf('7')).toBe(3);
    expect(Toast.fail).toHaveBeenCalledWith(expect.stringMatching(/refused/i), 3);
  });

  it('treats "already a member" as done: the join stays and nothing is undone', async () => {
    chain.joinGroup.mockRejectedValue(revert('AlreadyMember'));

    await setClubMember('7', true);
    await getOutbox().drain();

    expect(useCommunityStore.getState().joinedClubIds).toEqual(['7']);
    expect(Toast.fail).not.toHaveBeenCalled();
  });

  it('keeps the join on screen and retries when the network fails, never undoing it', async () => {
    chain.joinGroup.mockRejectedValueOnce(new Error('Network request failed'));

    await setClubMember('7', true);
    await getOutbox().drain();

    expect(useCommunityStore.getState().joinedClubIds).toEqual(['7']);
    expect(Toast.fail).not.toHaveBeenCalled();
    expect(getOutbox().entries()).toHaveLength(1);
  });

  it('sends only the latest wish when the athlete joins and leaves while offline', async () => {
    network.online = false;
    await setClubMember('7', true);
    await setClubMember('7', false);
    expect(chain.joinGroup).not.toHaveBeenCalled();

    network.online = true;
    await getOutbox().drain();

    expect(chain.joinGroup).not.toHaveBeenCalled();
    expect(chain.leaveGroup).toHaveBeenCalledTimes(1);
    expect(useCommunityStore.getState().joinedClubIds).toEqual([]);
  });

  it('waits offline without losing the join, and delivers it when the connection returns', async () => {
    network.online = false;
    await setClubMember('7', true);
    await getOutbox().drain();
    expect(chain.joinGroup).not.toHaveBeenCalled();
    expect(useCommunityStore.getState().joinedClubIds).toEqual(['7']);

    network.online = true;
    await getOutbox().drain();

    expect(chain.joinGroup).toHaveBeenCalledTimes(1);
    expect(getOutbox().entries()).toHaveLength(0);
  });

  it('keeps two clubs independent: refusing one does not undo the other', async () => {
    chain.joinGroup.mockImplementation(async (_w: unknown, id: bigint) => {
      if (id === 8n) throw revert('GroupDissolved');
      return { confirmed: true };
    });

    await setClubMember('7', true);
    await setClubMember('8', true);
    await getOutbox().drain();

    expect(useCommunityStore.getState().joinedClubIds).toEqual(['7']);
  });
});

describe('joining an event', () => {
  it('joins at once and is undone when the event is full or over', async () => {
    chain.joinEvent.mockRejectedValue(revert('EventEnded'));

    await setEventMember('21', true);
    expect(useCommunityStore.getState().joinedEvents).toContain('21');
    await getOutbox().drain();

    expect(useCommunityStore.getState().joinedEvents).toEqual([]);
    expect(Toast.fail).toHaveBeenCalled();
  });
});
