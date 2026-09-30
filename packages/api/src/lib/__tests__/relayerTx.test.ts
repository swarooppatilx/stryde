import {
  HttpRequestError,
  TransactionNotFoundError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { outOfGas, revertedWith } from '../../test-utils/viemErrors.js';
import { GasPriceTooHighError, ReceiptTimeoutError } from '../relayErrors.js';
import { createRelayTx, MAX_FEE_BUMPS, type RelayTxDeps } from '../relayerTx.js';

const CONTRACT = { address: '0x00000000000000000000000000000000000000c1', abi: [] } as never;
const ACCOUNT = { address: '0x00000000000000000000000000000000000000aa' };

function deps(overrides: Partial<RelayTxDeps> = {}) {
  const writes: string[] = [];
  const base: RelayTxDeps = {
    publicClient: {
      simulateContract: vi.fn(async (req) => ({ request: req })),
      waitForTransactionReceipt: vi.fn(async ({ hash }: { hash: string }) => ({
        status: 'success' as const,
        transactionHash: hash,
      })),
      estimateFeesPerGas: vi.fn(async () => ({ maxFeePerGas: 10n })),
    } as never,
    wallet: {
      account: ACCOUNT,
      writeContract: vi.fn(async (req: { functionName: string }) => {
        writes.push(req.functionName);
        return `0x${String(writes.length).padStart(64, '0')}` as `0x${string}`;
      }),
    } as never,
    resolveContract: () => CONTRACT,
    maxFeePerGas: undefined,
    ...overrides,
  };
  return { base, writes };
}

describe('relayTx', () => {
  it('simulates first, then writes, and reports the receipt status', async () => {
    const { base } = deps();

    const result = await createRelayTx(base)({
      contract: 'seasonManager',
      functionName: 'startSeason',
      args: [1n],
    });

    expect(result).toEqual({
      hash: `0x${'1'.padStart(64, '0')}`,
      confirmed: true,
      replaced: false,
    });
    expect(base.publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'startSeason', account: ACCOUNT })
    );
  });

  it('reports a reverted receipt as not confirmed', async () => {
    const { base } = deps();
    vi.mocked(base.publicClient.waitForTransactionReceipt).mockResolvedValue({
      status: 'reverted',
    } as never);

    const result = await createRelayTx(base)({ contract: 'x', functionName: 'f', args: [] });

    expect(result.confirmed).toBe(false);
  });

  it('never sends (and so never spends gas) when the simulation reverts', async () => {
    const { base } = deps();
    vi.mocked(base.publicClient.simulateContract).mockRejectedValue(new Error('NotRecorder'));

    await expect(
      createRelayTx(base)({ contract: 'x', functionName: 'f', args: [] })
    ).rejects.toThrow('NotRecorder');
    expect(base.wallet.writeContract).not.toHaveBeenCalled();
  });

  it('refuses to send when the network fee is above the cap', async () => {
    const { base } = deps({ maxFeePerGas: 5n });

    await expect(
      createRelayTx(base)({ contract: 'x', functionName: 'f', args: [] })
    ).rejects.toBeInstanceOf(GasPriceTooHighError);
    expect(base.wallet.writeContract).not.toHaveBeenCalled();
  });

  it('sends when the fee is within the cap', async () => {
    const { base } = deps({ maxFeePerGas: 10n });

    const result = await createRelayTx(base)({ contract: 'x', functionName: 'f', args: [] });

    expect(result.confirmed).toBe(true);
  });

  // Two sends from one account racing on the nonce is how transactions get
  // replaced or dropped: the second may only start once the first is sent.
  it('sends one transaction at a time', async () => {
    const { base } = deps();
    let releaseFirst: (hash: `0x${string}`) => void = () => {};
    const order: string[] = [];
    vi.mocked(base.wallet.writeContract)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            order.push('first:start');
            releaseFirst = (hash) => {
              order.push('first:sent');
              resolve(hash);
            };
          }) as never
      )
      .mockImplementationOnce((async () => {
        order.push('second:start');
        return `0x${'2'.padStart(64, '0')}`;
      }) as never);
    const send = createRelayTx(base);

    const first = send({ contract: 'x', functionName: 'a', args: [] });
    const second = send({ contract: 'x', functionName: 'b', args: [] });
    await vi.waitFor(() => expect(order).toEqual(['first:start']));
    releaseFirst(`0x${'1'.padStart(64, '0')}`);
    await Promise.all([first, second]);

    expect(order).toEqual(['first:start', 'first:sent', 'second:start']);
  });

  it('does not make the next send wait for the previous transaction to be mined', async () => {
    const { base } = deps();
    let finishFirstReceipt: () => void = () => {};
    vi.mocked(base.publicClient.waitForTransactionReceipt)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirstReceipt = () => resolve({ status: 'success' } as never);
          }) as never
      )
      .mockResolvedValue({ status: 'success' } as never);
    const send = createRelayTx(base);

    const first = send({ contract: 'x', functionName: 'a', args: [] });
    const second = await send({ contract: 'x', functionName: 'b', args: [] });
    finishFirstReceipt();
    await first;

    expect(second.confirmed).toBe(true);
  });

  it('keeps sending after one send failed', async () => {
    const { base } = deps();
    vi.mocked(base.publicClient.simulateContract)
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation((async (req: unknown) => ({ request: req })) as never);
    const send = createRelayTx(base);

    await expect(send({ contract: 'x', functionName: 'a', args: [] })).rejects.toThrow('boom');

    expect((await send({ contract: 'x', functionName: 'b', args: [] })).confirmed).toBe(true);
  });
});

describe('relayTx send failures', () => {
  const call = { contract: 'x', functionName: 'f', args: [] as never[] };

  it('treats a lost reply from the node as possibly sent', async () => {
    const { base } = deps();
    const lost = new HttpRequestError({ url: 'https://rpc.test' });
    vi.mocked(base.wallet.writeContract).mockRejectedValue(lost);

    const failure = await createRelayTx(base)(call).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ReceiptTimeoutError);
    expect((failure as Error).cause).toBe(lost);
  });

  it('treats an unknown error from the send as possibly sent', async () => {
    const { base } = deps();
    vi.mocked(base.wallet.writeContract).mockRejectedValue(new Error('socket hang up'));

    await expect(createRelayTx(base)(call)).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });

  it.each([
    ['a contract revert', () => revertedWith('NotRecorder')],
    ['insufficient funds', () => outOfGas()],
  ])('passes through %s: the node refused it, nothing was sent', async (_label, make) => {
    const { base } = deps();
    const refusal = make();
    vi.mocked(base.wallet.writeContract).mockRejectedValue(refusal);

    await expect(createRelayTx(base)(call)).rejects.toBe(refusal);
  });
});

describe('relayTx fee bumping', () => {
  const hashOf = (n: number) => `0x${String(n).padStart(64, '0')}` as `0x${string}`;
  const call = { contract: 'x', functionName: 'f', args: [] as never[] };
  const timeout = (hash: `0x${string}`) => new WaitForTransactionReceiptTimeoutError({ hash });
  const pending = () => new Promise<never>(() => {});

  /** A relayer whose first tx sits at nonce 7 paying 100 / tip 10; `mined` says which hashes the chain has mined. */
  function stuckRelayer(
    overrides: Partial<RelayTxDeps> = {},
    mined: (hash: string, wait: number) => boolean = () => false
  ) {
    const { base } = deps(overrides);
    const waitsPerHash = new Map<string, number>();
    let sends = 0;
    vi.mocked(base.wallet.writeContract).mockImplementation((async () => hashOf(++sends)) as never);
    Object.assign(base.publicClient, {
      getTransaction: vi.fn(async () => ({
        nonce: 7,
        gas: 50_000n,
        value: 0n,
        maxFeePerGas: 100n,
        maxPriorityFeePerGas: 10n,
      })),
    });
    vi.mocked(base.publicClient.waitForTransactionReceipt).mockImplementation((async ({
      hash,
    }: {
      hash: `0x${string}`;
    }) => {
      const wait = (waitsPerHash.get(hash) ?? 0) + 1;
      waitsPerHash.set(hash, wait);
      if (mined(hash, wait)) return { status: 'success', transactionHash: hash };
      throw timeout(hash);
    }) as never);
    return base;
  }

  const resends = (base: RelayTxDeps) =>
    vi
      .mocked(base.wallet.writeContract)
      .mock.calls.slice(1)
      .map(([req]) => req as unknown as Record<string, bigint | number>);

  it('does not bump when the transaction is mined before the deadline', async () => {
    const base = stuckRelayer({}, () => true);

    const result = await createRelayTx(base)(call);

    expect(result).toEqual({ hash: hashOf(1), confirmed: true, replaced: false });
    expect(base.wallet.writeContract).toHaveBeenCalledTimes(1);
  });

  it('re-sends once at the same nonce with fees raised by 12.5% when nothing is mined', async () => {
    const base = stuckRelayer({}, (hash) => hash === hashOf(2));

    const result = await createRelayTx(base)(call);

    expect(result).toEqual({ hash: hashOf(2), confirmed: true, replaced: true });
    const [bump] = resends(base);
    expect(bump).toMatchObject({ nonce: 7, maxFeePerGas: 113n, maxPriorityFeePerGas: 12n });
    // Replacement needs at least +10% on both fees.
    expect(bump?.maxFeePerGas as bigint).toBeGreaterThanOrEqual(110n);
    expect(bump?.maxPriorityFeePerGas as bigint).toBeGreaterThanOrEqual(11n);
  });

  it('bumps legacy transactions through gasPrice', async () => {
    const base = stuckRelayer({}, (hash) => hash === hashOf(2));
    vi.mocked(base.publicClient.getTransaction).mockResolvedValue({
      nonce: 3,
      gas: 50_000n,
      value: 0n,
      gasPrice: 80n,
    });

    await createRelayTx(base)(call);

    expect(resends(base)[0]).toMatchObject({ nonce: 3, gasPrice: 90n });
  });

  it('succeeds when the original lands while the replacement is still pending', async () => {
    const base = stuckRelayer();
    vi.mocked(base.publicClient.waitForTransactionReceipt).mockImplementation((async ({
      hash,
    }: {
      hash: `0x${string}`;
    }) => {
      const round = vi.mocked(base.wallet.writeContract).mock.calls.length;
      if (round === 1) throw timeout(hash);
      if (hash === hashOf(1)) return { status: 'success', transactionHash: hash };
      return pending();
    }) as never);

    const result = await createRelayTx(base)(call);

    expect(result).toEqual({ hash: hashOf(1), confirmed: true, replaced: false });
  });

  it('keeps raising the fee, each time above the last, up to two bumps then gives up', async () => {
    const base = stuckRelayer();

    await expect(createRelayTx(base)(call)).rejects.toBeInstanceOf(ReceiptTimeoutError);

    const fees = resends(base).map((r) => r.maxFeePerGas as bigint);
    expect(fees).toHaveLength(MAX_FEE_BUMPS);
    expect(fees).toEqual([113n, 128n]);
  });

  it('holds the bump to the cap and uses it exactly when the cap still leaves +10%', async () => {
    const base = stuckRelayer({ maxFeePerGas: 112n }, (hash) => hash === hashOf(2));

    await createRelayTx(base)(call);

    expect(resends(base)[0]).toMatchObject({ maxFeePerGas: 112n, maxPriorityFeePerGas: 12n });
  });

  it('stops with a gas-price error at the cap, and the next queued job still runs', async () => {
    const base = stuckRelayer({ maxFeePerGas: 105n });
    vi.mocked(base.publicClient.simulateContract).mockImplementation((async (req: unknown) => ({
      request: req,
    })) as never);
    const send = createRelayTx(base);

    const stuck = send({ ...call, functionName: 'stuck' });
    const next = send({ ...call, functionName: 'next' });
    const [first, second] = await Promise.allSettled([stuck, next]);

    // Sent but never confirmed, so it is reported as unconfirmed (503), with the cap as the cause.
    expect(first.status === 'rejected' && first.reason).toBeInstanceOf(ReceiptTimeoutError);
    expect(first.status === 'rejected' && first.reason.cause).toBeInstanceOf(GasPriceTooHighError);
    // The follow-up job was sent (not left waiting behind the failed bump).
    expect(vi.mocked(base.wallet.writeContract).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(second.status).toBe('rejected');
    expect(second.status === 'rejected' && second.reason).toBeInstanceOf(ReceiptTimeoutError);
    expect(resends(base).some((r) => 'nonce' in r)).toBe(false);
  });

  it('treats "nonce too low" on the resend as the original having mined', async () => {
    const base = stuckRelayer({}, (hash, wait) => hash === hashOf(1) && wait > 1);
    vi.mocked(base.wallet.writeContract)
      .mockResolvedValueOnce(hashOf(1))
      .mockRejectedValueOnce(new Error('nonce too low: next nonce 8, tx nonce 7'));

    const result = await createRelayTx(base)(call);

    expect(result).toEqual({ hash: hashOf(1), confirmed: true, replaced: false });
  });

  it('treats "already known" on the resend as nothing to do and keeps waiting', async () => {
    const base = stuckRelayer({}, (hash, wait) => hash === hashOf(1) && wait > 1);
    vi.mocked(base.wallet.writeContract)
      .mockResolvedValueOnce(hashOf(1))
      .mockRejectedValueOnce(new Error('already known'));

    expect((await createRelayTx(base)(call)).hash).toBe(hashOf(1));
  });

  it('bumps again, from the rejected fee, after "replacement transaction underpriced"', async () => {
    const base = stuckRelayer({}, (hash) => hash === hashOf(2));
    vi.mocked(base.wallet.writeContract)
      .mockResolvedValueOnce(hashOf(1))
      .mockRejectedValueOnce(new Error('replacement transaction underpriced'))
      .mockResolvedValueOnce(hashOf(2));

    const result = await createRelayTx(base)(call);

    expect(result.hash).toBe(hashOf(2));
    expect(resends(base).map((r) => r.maxFeePerGas)).toEqual([113n, 128n]);
  });

  it('reports an unrecognised resend error as unconfirmed and leaves the queue usable', async () => {
    const base = stuckRelayer({}, (hash) => hash === hashOf(5));
    vi.mocked(base.wallet.writeContract)
      .mockResolvedValueOnce(hashOf(1))
      .mockRejectedValueOnce(new Error('rpc exploded'))
      .mockResolvedValue(hashOf(5));
    const send = createRelayTx(base);

    const failure = await send(call).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ReceiptTimeoutError);
    expect((failure as Error).cause).toEqual(new Error('rpc exploded'));

    expect((await send(call)).hash).toBe(hashOf(5));
  });

  it('reports the replacement as the winner when viem answers for the original hash with its receipt', async () => {
    const base = stuckRelayer();
    vi.mocked(base.publicClient.waitForTransactionReceipt).mockImplementation((async ({
      hash,
    }: {
      hash: `0x${string}`;
    }) => {
      if (vi.mocked(base.wallet.writeContract).mock.calls.length === 1) throw timeout(hash);
      // Same-nonce replacement mined: asking about hash 1 returns hash 2's receipt.
      return { status: 'success', transactionHash: hashOf(2) };
    }) as never);

    const result = await createRelayTx(base)(call);

    expect(result).toEqual({ hash: hashOf(2), confirmed: true, replaced: true });
  });

  it('pins gas and value from the original so the resend is not estimated again', async () => {
    const base = stuckRelayer({}, (hash) => hash === hashOf(2));

    await createRelayTx(base)(call);

    expect(resends(base)[0]).toMatchObject({ gas: 50_000n, value: 0n });
  });

  it('does not report a 409-style revert when the original mines during the resend', async () => {
    const base = stuckRelayer({}, (hash, wait) => hash === hashOf(1) && wait > 1);
    vi.mocked(base.wallet.writeContract)
      .mockResolvedValueOnce(hashOf(1))
      .mockRejectedValueOnce(new Error('nonce too low'));

    const result = await createRelayTx(base)(call);

    expect(result).toEqual({ hash: hashOf(1), confirmed: true, replaced: false });
  });

  it('keeps waiting when the sent transaction cannot be looked up, then reports it unconfirmed', async () => {
    const base = stuckRelayer();
    vi.mocked(base.publicClient.getTransaction).mockRejectedValue(
      new TransactionNotFoundError({ hash: hashOf(1) })
    );

    await expect(createRelayTx(base)(call)).rejects.toBeInstanceOf(ReceiptTimeoutError);
    expect(base.wallet.writeContract).toHaveBeenCalledTimes(1);
    expect(base.publicClient.waitForTransactionReceipt).toHaveBeenCalledTimes(MAX_FEE_BUMPS + 1);
  });

  it('still succeeds when the original mines after a failed lookup', async () => {
    const base = stuckRelayer({}, (hash, wait) => hash === hashOf(1) && wait > 1);
    vi.mocked(base.publicClient.getTransaction).mockRejectedValue(
      new TransactionNotFoundError({ hash: hashOf(1) })
    );

    expect((await createRelayTx(base)(call)).hash).toBe(hashOf(1));
  });

  it('gives up with ReceiptTimeoutError once the overall time budget is spent', async () => {
    let clock = 0;
    const base = stuckRelayer({ now: () => clock, maxTotalMs: 100, receiptTimeoutMs: 40 });
    vi.mocked(base.publicClient.waitForTransactionReceipt).mockImplementation((async ({
      hash,
      timeout: ms,
    }: {
      hash: `0x${string}`;
      timeout: number;
    }) => {
      // Every round includes the original, so only it advances the clock.
      if (hash === hashOf(1)) clock += ms;
      throw new WaitForTransactionReceiptTimeoutError({ hash });
    }) as never);

    await expect(createRelayTx(base)(call)).rejects.toBeInstanceOf(ReceiptTimeoutError);

    // 40 + 40 ms, then only the 20 ms left; the budget ends the relay, not the bump count.
    const originalWaits = vi
      .mocked(base.publicClient.waitForTransactionReceipt)
      .mock.calls.filter(([w]) => w.hash === hashOf(1));
    expect(originalWaits.map(([w]) => w.timeout)).toEqual([40, 40, 20]);
  });
});
