import { describe, expect, it, vi } from 'vitest';

const readContract = vi.hoisted(() => vi.fn().mockResolvedValue(false));

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return {
    ...actual,
    getPublicClient: () => ({
      readContract,
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success', logs: [] }),
    }),
  };
});

const { computeCommentId, setKudos, toggleKudos } = await import('../social');

describe('social.toggleKudos', () => {
  const ADDRESS = '0x00000000000000000000000000000000000000aa';
  const account = { address: ADDRESS, type: 'smart' };

  // The account object signs; contract args need its address. Passing the
  // object as an arg made viem reject "[object Object]" and kudos never sent.
  it('reads hasKudos with the address and writes with the account object', async () => {
    const writeContract = vi.fn().mockResolvedValue(`0x${'11'.repeat(32)}`);
    const wallet = { account, writeContract } as unknown as Parameters<typeof toggleKudos>[0];

    const result = await toggleKudos(wallet, 7n);

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [7n, ADDRESS] }));
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ account }));
    expect(result).toMatchObject({ confirmed: true, gave: true });
  });
});

describe('social.setKudos', () => {
  const ADDRESS = '0x00000000000000000000000000000000000000aa';
  const account = { address: ADDRESS, type: 'smart' };
  const walletWith = (writeContract: ReturnType<typeof vi.fn>) =>
    ({ account, writeContract }) as unknown as Parameters<typeof setKudos>[0];

  it('sends nothing when the chain already has the wanted state, so a retry cannot flip it back', async () => {
    readContract.mockResolvedValueOnce(true);
    const writeContract = vi.fn();

    const result = await setKudos(walletWith(writeContract), 7n, true);

    expect(writeContract).not.toHaveBeenCalled();
    expect(result).toEqual({ changed: false });
  });

  it('toggles once when the chain differs from what was wanted', async () => {
    readContract.mockResolvedValueOnce(false);
    const writeContract = vi.fn().mockResolvedValue(`0x${'22'.repeat(32)}`);

    const result = await setKudos(walletWith(writeContract), 7n, true);

    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ changed: true, confirmed: true });
  });

  it('removes a kudos that is there when none is wanted', async () => {
    readContract.mockResolvedValueOnce(true);
    const writeContract = vi.fn().mockResolvedValue(`0x${'33'.repeat(32)}`);

    const result = await setKudos(walletWith(writeContract), 7n, false);

    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ changed: true });
  });
});

describe('replayKudos', () => {
  const base = { activityId: 1n, giver: '0xaa', timestamp: 1 };

  it('keeps a kudos that was given, revoked, then given again', async () => {
    const { replayKudos } = await import('../social');

    const result = replayKudos([
      { ...base, active: true, blockNumber: 30n, logIndex: 0 },
      { ...base, active: false, blockNumber: 20n, logIndex: 0 },
      { ...base, active: true, blockNumber: 10n, logIndex: 0 },
    ]);

    expect(result).toHaveLength(1);
  });

  it('drops a kudos whose last event is a revoke, using log order inside one block', async () => {
    const { replayKudos } = await import('../social');

    const result = replayKudos([
      { ...base, active: false, blockNumber: 10n, logIndex: 5 },
      { ...base, active: true, blockNumber: 10n, logIndex: 2 },
    ]);

    expect(result).toEqual([]);
  });
});

describe('computeCommentId', () => {
  const author = '0x00000000000000000000000000000000000000aa' as const;

  it('gives the same id for the same inputs, as it always did without a nonce', () => {
    expect(computeCommentId(7n, author, 'nice', 100n)).toBe(
      computeCommentId(7n, author, 'nice', 100n)
    );
  });

  it('gives two comments with the same text in the same second two different ids once a nonce is passed', () => {
    const first = computeCommentId(7n, author, 'nice', 100n, 'a');
    const second = computeCommentId(7n, author, 'nice', 100n, 'b');

    expect(first).not.toBe(second);
  });

  it('leaves the id unchanged when the nonce is left out, so stored ids stay valid', () => {
    expect(computeCommentId(7n, author, 'nice', 100n)).toBe(
      computeCommentId(7n, author, 'nice', 100n, '')
    );
  });
});
