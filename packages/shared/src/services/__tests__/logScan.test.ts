import { describe, expect, it, vi } from 'vitest';
import { LOG_WINDOW_BLOCKS, scanLogWindows } from '../logScan';

describe('scanLogWindows', () => {
  it('covers deploy block to latest in windows the RPC accepts, oldest first', async () => {
    const deploy = 1_000n;
    const latest = deploy + LOG_WINDOW_BLOCKS * 2n + 10n;
    const fetchWindow = vi.fn(async (from: bigint, to: bigint) => [`${from}-${to}`]);

    const logs = await scanLogWindows(fetchWindow, { fromBlock: deploy, latest });

    const ranges = fetchWindow.mock.calls;
    expect(ranges[0]?.[0]).toBe(deploy);
    expect(ranges[ranges.length - 1]?.[1]).toBe(latest);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]?.[0]).toBe((ranges[i - 1]?.[1] as bigint) + 1n);
    }
    for (const [from, to] of ranges) expect(to - from + 1n).toBeLessThanOrEqual(LOG_WINDOW_BLOCKS);
    expect(logs).toHaveLength(ranges.length);
  });

  it('makes one call when the whole range fits', async () => {
    const fetchWindow = vi.fn(async () => ['a', 'b']);

    expect(await scanLogWindows(fetchWindow, { fromBlock: 0n, latest: 500n })).toEqual(['a', 'b']);
    expect(fetchWindow).toHaveBeenCalledWith(0n, 500n);
  });

  it('retries a window when the node serving it is a few blocks behind the head we were given', async () => {
    // Public RPCs sit behind a load balancer; the node that answers getLogs can lag the one that
    // answered getBlockNumber ("block range extends beyond current head block").
    const lagging = new Error(
      'block range extends beyond current head block: requested 12069715, head 12069712'
    );
    const fetchWindow = vi.fn().mockRejectedValueOnce(lagging).mockResolvedValueOnce(['a']);

    const logs = await scanLogWindows(fetchWindow, { fromBlock: 0n, latest: 500n }, 0);

    expect(logs).toEqual(['a']);
    expect(fetchWindow).toHaveBeenCalledTimes(2);
    expect(fetchWindow).toHaveBeenNthCalledWith(2, 0n, 500n);
  });

  it('gives up on a node that stays behind instead of retrying forever', async () => {
    const lagging = new Error('block range extends beyond current head block');
    const fetchWindow = vi.fn().mockRejectedValue(lagging);

    await expect(scanLogWindows(fetchWindow, { fromBlock: 0n, latest: 500n }, 0)).rejects.toThrow(
      /beyond current head/
    );
    expect(fetchWindow.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('does not retry an unrelated failure', async () => {
    const fetchWindow = vi.fn().mockRejectedValue(new Error('rpc down'));

    await expect(scanLogWindows(fetchWindow, { fromBlock: 0n, latest: 500n }, 0)).rejects.toThrow(
      'rpc down'
    );
    expect(fetchWindow).toHaveBeenCalledTimes(1);
  });

  it('rejects if any window fails, rather than returning a partial history', async () => {
    const fetchWindow = vi
      .fn()
      .mockResolvedValueOnce(['a'])
      .mockRejectedValueOnce(new Error('rpc down'));

    await expect(
      scanLogWindows(fetchWindow, { fromBlock: 0n, latest: LOG_WINDOW_BLOCKS * 2n })
    ).rejects.toThrow('rpc down');
  });
});
