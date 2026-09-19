import { getActiveConfig, getPublicClient } from './client';

/** Public Sepolia RPCs reject eth_getLogs spans wider than 50,000 blocks. */
export const LOG_WINDOW_BLOCKS = 50_000n;

/**
 * Runs `fetchWindow` over the deployment's whole history in RPC-sized windows, oldest first,
 * so "last write wins" readers still see logs in order. Rejects if any window fails.
 */
export async function scanLogWindows<T>(
  fetchWindow: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  range?: { fromBlock: bigint; latest: bigint }
): Promise<T[]> {
  const fromBlock = range?.fromBlock ?? getActiveConfig().deployBlock;
  const latest = range?.latest ?? (await getPublicClient().getBlockNumber());
  const logs: T[] = [];
  for (let start = fromBlock; start <= latest; start += LOG_WINDOW_BLOCKS) {
    const end = start + LOG_WINDOW_BLOCKS - 1n;
    logs.push(...(await fetchWindow(start, end < latest ? end : latest)));
  }
  return logs;
}
