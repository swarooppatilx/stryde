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
