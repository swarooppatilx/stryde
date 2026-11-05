import { describe, expect, it, vi } from 'vitest';
import { RejectedError } from '@/backends/outbox/outbox';
import { createMembershipHandlers, type MembershipDeps } from '@/services/membershipIntents';

const wallet = {} as never;
const revert = (errorName: string) =>
  Object.assign(new Error(errorName), {
    name: 'ContractFunctionRevertedError',
    data: { errorName },
  });

function setup(
  over: Partial<MembershipDeps['chain']> = {},
  walletOf: () => never | null = () => wallet
) {
  const chain: MembershipDeps['chain'] = {
    joinClub: vi.fn(async () => ({ confirmed: true })),
    leaveClub: vi.fn(async () => ({ confirmed: true })),
    joinEvent: vi.fn(async () => ({ confirmed: true })),
    leaveEvent: vi.fn(async () => ({ confirmed: true })),
    ...over,
  };
  return { chain, handlers: createMembershipHandlers({ wallet: walletOf, chain }) };
}

describe('club membership', () => {
  it('joins and leaves with the wanted state', async () => {
    const { chain, handlers } = setup();

    await handlers.club({ id: '7', member: true });
    await handlers.club({ id: '7', member: false });

    expect(chain.joinClub).toHaveBeenCalledWith(wallet, 7n);
    expect(chain.leaveClub).toHaveBeenCalledWith(wallet, 7n);
  });

  it('counts "already a member" as done, so a retry after success is harmless', async () => {
    const { handlers } = setup({ joinClub: vi.fn().mockRejectedValue(revert('AlreadyMember')) });
    await expect(handlers.club({ id: '7', member: true })).resolves.toBeUndefined();
  });

  it('counts "not a member" as done when leaving', async () => {
    const { handlers } = setup({ leaveClub: vi.fn().mockRejectedValue(revert('NotMember')) });
    await expect(handlers.club({ id: '7', member: false })).resolves.toBeUndefined();
  });

  it('refuses for good when the club does not exist', async () => {
    const { handlers } = setup({ joinClub: vi.fn().mockRejectedValue(revert('GroupNotFound')) });
    await expect(handlers.club({ id: '7', member: true })).rejects.toBeInstanceOf(RejectedError);
  });

  it('waits when there is no wallet, and retries an unconfirmed or failed send', async () => {
    await expect(setup({}, () => null).handlers.club({ id: '7', member: true })).rejects.toThrow(
      'No wallet yet'
    );
    const unconfirmed = setup({ joinClub: vi.fn(async () => ({ confirmed: false })) });
    await expect(unconfirmed.handlers.club({ id: '7', member: true })).rejects.not.toBeInstanceOf(
      RejectedError
    );
    const down = setup({ joinClub: vi.fn().mockRejectedValue(new Error('rpc down')) });
    await expect(down.handlers.club({ id: '7', member: true })).rejects.not.toBeInstanceOf(
      RejectedError
    );
  });
});

describe('event membership', () => {
  it('joins and leaves with the wanted state', async () => {
    const { chain, handlers } = setup();

    await handlers.event({ id: '3', member: true });
    await handlers.event({ id: '3', member: false });

    expect(chain.joinEvent).toHaveBeenCalledWith(wallet, 3n);
    expect(chain.leaveEvent).toHaveBeenCalledWith(wallet, 3n);
  });

  it('counts "already joined" and "not a participant" as done', async () => {
    const joined = setup({ joinEvent: vi.fn().mockRejectedValue(revert('AlreadyJoined')) });
    await expect(joined.handlers.event({ id: '3', member: true })).resolves.toBeUndefined();
    const left = setup({ leaveEvent: vi.fn().mockRejectedValue(revert('NotParticipant')) });
    await expect(left.handlers.event({ id: '3', member: false })).resolves.toBeUndefined();
  });

  it('refuses for good when the event has ended', async () => {
    const { handlers } = setup({ joinEvent: vi.fn().mockRejectedValue(revert('EventEnded')) });
    await expect(handlers.event({ id: '3', member: true })).rejects.toBeInstanceOf(RejectedError);
  });
});
