import { logError } from '../logError.js';
export interface Freshness {
  syncedBlock: string | null;
  /** True when the last sync failed, so the answer may lag the chain. */
  stale: boolean;
}

interface Options {
  run(): Promise<{ block: bigint }>;
  /** How long a successful sync is trusted. */
  ttlMs: number;
  now?(): number;
}

/** After a failed sync, how long before the next read tries again: soon, but not on every request. */
const RETRY_AFTER_FAILURE_MS = 5_000;

/**
 * Keeps a mirror fresh without a background worker: the first read after the window runs a sync,
 * readers who arrive meanwhile share it, and a failure never reaches a reader (they get what the
 * mirror holds, flagged stale).
 */
export function createFreshness({ run, ttlMs, now = Date.now }: Options) {
  let syncedBlock: string | null = null;
  let failed = false;
  let nextAt = 0;
  let inFlight: Promise<void> | null = null;

  const start = () => {
    inFlight ??= run()
      .then((result) => {
        syncedBlock = result.block.toString();
        failed = false;
        nextAt = now() + ttlMs;
      })
      .catch((error) => {
        // Reads keep answering from the last good sync, flagged stale; the reason belongs in the logs.
        logError('[index] Sync failed:', error);
        failed = true;
        nextAt = now() + RETRY_AFTER_FAILURE_MS;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    async ensure(): Promise<Freshness> {
      if (inFlight) await inFlight;
      else if (now() >= nextAt) await start();
      return { syncedBlock, stale: failed };
    },

    /** Syncs now and lets the error through: the manual trigger wants to know. */
    async force() {
      const result = await run();
      syncedBlock = result.block.toString();
      failed = false;
      nextAt = now() + ttlMs;
      return result;
    },
  };
}
