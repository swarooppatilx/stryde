import { describe, expect, it, vi } from 'vitest';
import { RejectedError } from '@/backends/outbox/outbox';
import {
  ACCOUNT_DELETE,
  ACCOUNT_DELETE_KEY,
  createAccountDeleteHandler,
  requestAccountDeletion,
} from '@/services/accountDeletion';

const wallet = {} as never;
const counts = {
  follows: 1,
  posts: 0,
  about: 0,
  commentLikes: 0,
  reports: 0,
  pushTokens: 1,
  beacons: 0,
};
const apiError = (status: number) => Object.assign(new Error('nope'), { status });

describe('createAccountDeleteHandler', () => {
  it('sends the request and hands back what was removed', async () => {
    const send = vi.fn(async () => ({ deleted: true, counts }));
    const onResult = vi.fn();

    await createAccountDeleteHandler({ wallet: () => wallet, send, onResult })({});

    expect(send).toHaveBeenCalledWith(wallet);
    expect(onResult).toHaveBeenCalledWith(counts);
  });

  it('waits and tries again when there is no account to sign with', async () => {
    const send = vi.fn();
    await expect(
      createAccountDeleteHandler({ wallet: () => null, send, onResult: vi.fn() })({})
    ).rejects.not.toBeInstanceOf(RejectedError);
    expect(send).not.toHaveBeenCalled();
  });

  it('gives up for good on a refusal, and retries when the server is down', async () => {
    const refuse = createAccountDeleteHandler({
      wallet: () => wallet,
      send: vi.fn().mockRejectedValue(apiError(400)),
      onResult: vi.fn(),
    });
    const down = createAccountDeleteHandler({
      wallet: () => wallet,
      send: vi.fn().mockRejectedValue(apiError(503)),
      onResult: vi.fn(),
    });

    await expect(refuse({})).rejects.toBeInstanceOf(RejectedError);
    await expect(down({})).rejects.not.toBeInstanceOf(RejectedError);
  });
});

function fakeOutbox(afterDrain: 'delivered' | 'waiting' | 'refused') {
  return {
    enqueue: vi.fn(async () => ({}) as never),
    drain: vi.fn(async () => {}),
    statusOf: vi.fn(() => (afterDrain === 'waiting' ? ('pending' as const) : undefined)),
    consumeRejection: vi.fn(() => afterDrain === 'refused'),
  };
}

describe('requestAccountDeletion', () => {
  it('queues one request under its own key and tries to send it now', async () => {
    const outbox = fakeOutbox('delivered');

    await requestAccountDeletion(outbox);

    expect(outbox.enqueue).toHaveBeenCalledWith({
      kind: ACCOUNT_DELETE,
      payload: {},
      key: ACCOUNT_DELETE_KEY,
    });
    expect(outbox.drain).toHaveBeenCalled();
  });

  it.each([
    ['delivered', 'sent'],
    ['waiting', 'queued'],
    ['refused', 'refused'],
  ] as const)('says %s as %s', async (after, expected) => {
    expect(await requestAccountDeletion(fakeOutbox(after))).toBe(expected);
  });
});
