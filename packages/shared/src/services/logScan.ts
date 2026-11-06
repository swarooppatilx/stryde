import { getActiveConfig, getPublicClient } from './client';

/** Infura rejects eth_getLogs spans wider than 10,000 blocks. */
export const LOG_WINDOW_BLOCKS = 10_000n;

const LAGGING_NODE = /beyond current head/i;
const LAGGING_NODE_RETRIES = 3;

/** Retries a window only when the answering node is behind the head we were given; anything else is a real failure. */
async function fetchWithLagRetry<T>(
  fetchWindow: () => Promise<T[]>,
  retryDelayMs: number
): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchWindow();
    } catch (e) {
      const lagging =
        e instanceof Error &&
        LAGGING_NODE.test(`${e.message} ${(e as { details?: string }).details ?? ''}`);
      if (!lagging || attempt >= LAGGING_NODE_RETRIES) throw e;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

/**
 * Runs `fetchWindow` over the deployment's whole history in RPC-sized windows, oldest first,
 * so "last write wins" readers still see logs in order. Rejects if any window fails.
 */
export async function scanLogWindows<T>(
  fetchWindow: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  range?: { fromBlock: bigint; latest: bigint },
  retryDelayMs = 1_500
): Promise<T[]> {
  const fromBlock = range?.fromBlock ?? getActiveConfig().deployBlock;
  const latest = range?.latest ?? (await getPublicClient().getBlockNumber());
  const logs: T[] = [];
  for (let start = fromBlock; start <= latest; start += LOG_WINDOW_BLOCKS) {
    const end = start + LOG_WINDOW_BLOCKS - 1n;
    const to = end < latest ? end : latest;
    logs.push(...(await fetchWithLagRetry(() => fetchWindow(start, to), retryDelayMs)));
  }
  return logs;
}

/**
 * Like `scanLogWindows`, for activity history: starts at the chain's feed start block when it has
 * one, so older activity stays out, and at the deploy block otherwise.
 */
export async function scanFeedLogWindows<T>(
  fetchWindow: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  latest?: bigint
): Promise<T[]> {
  const { feedFromBlock, deployBlock } = getActiveConfig();
  return scanLogWindows(fetchWindow, {
    fromBlock: feedFromBlock && feedFromBlock > deployBlock ? feedFromBlock : deployBlock,
    latest: latest ?? (await getPublicClient().getBlockNumber()),
  });
}
