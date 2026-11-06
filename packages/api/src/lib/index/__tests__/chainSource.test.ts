import { describe, expect, it, vi } from 'vitest';
import { createChainMirrorSource } from '../chainSource.js';

const ADDR = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as const;
const contracts = {
  profileRegistry: ADDR(1),
  activityRegistry: ADDR(2),
  seasonManager: ADDR(3),
  achievementRegistry: ADDR(4),
  groupRegistry: ADDR(5),
  territoryRegistry: ADDR(6),
};
const HASH = `0x${'ab'.repeat(32)}` as const;

function fakeClient(over: Record<string, unknown> = {}) {
  return {
    getBlock: vi.fn(async (args: { blockTag?: string; blockNumber?: bigint }) => ({
      number: args.blockNumber ?? 500n,
      hash: HASH,
      timestamp: 1_790_000_000n + (args.blockNumber ?? 500n),
    })),
    getLogs: vi.fn(async (_args: { address: string; events: Array<{ name: string }> }) => []),
    ...over,
  };
}

describe('createChainMirrorSource', () => {
  it('reads the head block number and hash', async () => {
    const source = createChainMirrorSource(fakeClient() as never, contracts);

    expect(await source.head()).toEqual({ number: 500n, hash: HASH });
  });

  it('asks each contract only for the events the mirror keeps from it', async () => {
    const client = fakeClient();

    await createChainMirrorSource(client as never, contracts).events(10n, 20n);

    const asked = new Map(
      client.getLogs.mock.calls.map(([a]) => [a.address, a.events.map((e) => e.name)])
    );
    expect(asked.get(contracts.activityRegistry)).toEqual([
      'ActivityRecorded',
      'ActivityMetadataUpdated',
    ]);
    expect(asked.get(contracts.groupRegistry)).toEqual([
      'GroupCreated',
      'GroupJoined',
      'GroupLeft',
      'GroupDissolved',
    ]);
    expect(asked.size).toBe(6);
  });

  it('turns viem logs into plain decoded logs', async () => {
    const client = fakeClient({
      getLogs: vi.fn(async ({ address }: { address: string }) =>
        address === contracts.groupRegistry
          ? [
              {
                eventName: 'GroupJoined',
                args: { groupId: 1n, member: ADDR(9) },
                blockNumber: 12n,
                logIndex: 4,
              },
            ]
          : []
      ),
    });

    const logs = await createChainMirrorSource(client as never, contracts).events(10n, 20n);

    expect(logs).toEqual([
      {
        name: 'GroupJoined',
        args: { groupId: 1n, member: ADDR(9) },
        blockNumber: 12n,
        logIndex: 4,
      },
    ]);
  });

  it('skips a contract with no address on this chain instead of querying the zero address', async () => {
    const client = fakeClient();
    const zero = '0x0000000000000000000000000000000000000000' as const;

    await createChainMirrorSource(client as never, {
      ...contracts,
      territoryRegistry: zero,
    }).events(1n, 2n);

    expect(client.getLogs.mock.calls.some(([a]) => a.address === zero)).toBe(false);
  });

  it('answers null for the hash of a block the node does not have', async () => {
    const client = fakeClient({
      getBlock: vi.fn(async () => {
        throw new Error('Block not found');
      }),
    });

    expect(await createChainMirrorSource(client as never, contracts).hashAt(999n)).toBeNull();
  });

  it('reads a block timestamp as a plain number', async () => {
    const source = createChainMirrorSource(fakeClient() as never, contracts);

    expect(await source.timestampAt(7n)).toBe(1_790_000_007);
  });
});
