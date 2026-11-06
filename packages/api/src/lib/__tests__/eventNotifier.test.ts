import { describe, expect, it, vi } from 'vitest';
import type { Address } from '../address.js';
import {
  decodeLog,
  FIRST_RUN_LOOKBACK_BLOCKS,
  MAX_ATTEMPTS,
  NOTIFY_WINDOW_BLOCKS,
  type NotifyDeps,
  notifyNewEvents,
  type WatchedLog,
} from '../eventNotifier.js';

const ALICE: Address = '0x00000000000000000000000000000000000000a1';
const BOB: Address = '0x00000000000000000000000000000000000000b2';
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

const kudos = (n: number, giver = BOB, block = 1000n, activityId = 7n): WatchedLog => ({
  eventName: 'KudosGiven',
  transactionHash: tx(n),
  logIndex: n,
  blockNumber: block,
  args: { activityId, giver },
});

function setup(
  options: { stored?: bigint | null; head?: bigint; notify?: NotifyDeps['notify']; resolveRecipient?: NotifyDeps['resolveRecipient'] } = {}
) {
  const { stored: initial, head, ...overrides } = options;
  let stored = initial === undefined ? 900n : initial;
  const set = vi.fn(async (block: bigint) => {
    stored = block;
  });
  const notify = vi.fn<NotifyDeps['notify']>(async () => {});
  const getLogs = vi.fn(async () => [] as WatchedLog[]);
  const deps: NotifyDeps = {
    head: async () => head ?? 1100n,
    getLogs,
    resolveRecipient: vi.fn<NotifyDeps['resolveRecipient']>(async () => ALICE),
    notify,
    checkpoint: { get: async () => stored, set },
    ...overrides,
  };
  return { deps, set, notify, getLogs, stored: () => stored };
}

describe('decodeLog', () => {
  it('reads kudos, comments and challenge invites', () => {
    expect(decodeLog(kudos(1))).toMatchObject({
      kind: 'kudos',
      actor: BOB,
      activityId: 7n,
      id: '7',
    });
    expect(
      decodeLog({
        eventName: 'CommentAdded',
        transactionHash: tx(2),
        logIndex: 0,
        blockNumber: 1n,
        args: { activityId: 9n, author: BOB },
      })
    ).toMatchObject({ kind: 'comments', id: '9' });
    expect(
      decodeLog({
        eventName: 'ChallengeCreated',
        transactionHash: tx(3),
        logIndex: 0,
        blockNumber: 1n,
        args: { challengeId: 4n, challenger: BOB, opponent: ALICE },
      })
    ).toMatchObject({ kind: 'challenges', actor: BOB, recipient: ALICE, id: '4' });
  });
});

describe('notifyNewEvents', () => {
  it('sends one plain push to the activity owner', async () => {
    const { deps, notify } = setup();
    deps.getLogs = async () => [kudos(1)];
    await notifyNewEvents(deps);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(ALICE, {
      title: 'New kudos',
      body: 'Someone gave your activity kudos',
      data: { kind: 'kudos', id: '7' },
    });
  });

  it('notifies the challenged athlete without resolving an owner', async () => {
    const resolveRecipient = vi.fn(async () => null);
    const { deps, notify } = setup({ resolveRecipient });
    deps.getLogs = async () => [
      {
        eventName: 'ChallengeCreated',
        transactionHash: tx(5),
        logIndex: 0,
        blockNumber: 1000n,
        args: { challengeId: 4n, challenger: BOB, opponent: ALICE },
      },
    ];
    await notifyNewEvents(deps);
    expect(resolveRecipient).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      ALICE,
      expect.objectContaining({ data: { kind: 'challenges', id: '4' } })
    );
  });

  it('skips self-actions', async () => {
    const { deps, notify } = setup();
    deps.getLogs = async () => [kudos(1, ALICE)];
    const report = await notifyNewEvents(deps);
    expect(notify).not.toHaveBeenCalled();
    expect(report.skipped).toBe(1);
  });

  it('sends a repeated txHash and logIndex once', async () => {
    const { deps, notify } = setup();
    deps.getLogs = async () => [kudos(1), kudos(1)];
    await notifyNewEvents(deps);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('splits the range into windows of at most 40,000 blocks', async () => {
    const { deps, getLogs } = setup({ stored: 0n, head: 100_000n });
    await notifyNewEvents(deps);
    const ranges = getLogs.mock.calls.map(
      ([r]: unknown[]) => r as { fromBlock: bigint; toBlock: bigint }
    );
    expect(ranges).toEqual([
      { fromBlock: 1n, toBlock: NOTIFY_WINDOW_BLOCKS },
      { fromBlock: 40_001n, toBlock: 80_000n },
      { fromBlock: 80_001n, toBlock: 100_000n },
    ]);
  });

  it('advances the checkpoint to head after handling events', async () => {
    const { deps, set, stored } = setup();
    deps.getLogs = async () => [kudos(1)];
    await notifyNewEvents(deps);
    expect(set).toHaveBeenCalledWith(1100n);
    expect(stored()).toBe(1100n);
  });

  it('leaves the checkpoint alone across a short quiet stretch', async () => {
    const { deps, set } = setup();
    await notifyNewEvents(deps);
    expect(set).not.toHaveBeenCalled();
  });

  it('starts a first run a short lookback behind head', async () => {
    const { deps, getLogs, set } = setup({ stored: null, head: 5000n });
    await notifyNewEvents(deps);
    expect(getLogs).toHaveBeenCalledWith({
      fromBlock: 5000n - FIRST_RUN_LOOKBACK_BLOCKS,
      toBlock: 5000n,
    });
    expect(set).toHaveBeenCalledWith(5000n);
  });

  it('retries a failing push a bounded number of times, then moves on', async () => {
    const notify = vi.fn(async () => {
      throw new Error('down');
    });
    const { deps, set } = setup({ notify });
    deps.getLogs = async () => [kudos(1), kudos(2)];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = await notifyNewEvents(deps);
    spy.mockRestore();
    expect(notify).toHaveBeenCalledTimes(2 * MAX_ATTEMPTS);
    expect(report).toMatchObject({ failed: 2, sent: 0 });
    expect(set).toHaveBeenCalledWith(1100n);
  });

  it('keeps the checkpoint when reading logs fails', async () => {
    const { deps, set } = setup();
    deps.getLogs = async () => {
      throw new Error('rpc');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = await notifyNewEvents(deps);
    spy.mockRestore();
    expect(report.incomplete).toBe(true);
    expect(set).not.toHaveBeenCalled();
  });
});
