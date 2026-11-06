export interface RetryOptions {
  /** Total attempts, including the first. */
  retries: number;
  /** Delay before the second attempt; doubles after each failure. */
  baseMs: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Waits `ms` milliseconds. */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn` up to `retries` times with exponentially growing pauses; throws the last error. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  { retries, baseMs, sleep: wait = sleep }: RetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await wait(baseMs * 2 ** attempt);
    }
  }
  throw lastError;
}

export interface ReadUntilOptions {
  /** Total reads, including the first. */
  tries: number;
  /** Pause between reads. */
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads until `done(answer)` holds, up to `tries` times, and gives back the last answer either way.
 * Public RPCs sit behind a load balancer, so a read right after a confirmed write can still come from
 * a node that has not seen it (a challenge accepted on-chain kept showing "Open"); a failed read
 * counts as "not yet", and only when every read failed is there nothing to return and the error is thrown.
 */
export async function readUntil<T>(
  read: () => Promise<T>,
  done: (answer: T) => boolean,
  { tries, delayMs, sleep: wait = sleep }: ReadUntilOptions
): Promise<T> {
  let last: { value: T } | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const value = await read();
      last = { value };
      if (done(value)) return value;
    } catch (error) {
      lastError = error;
    }
    if (attempt < tries - 1) await wait(delayMs);
  }
  if (last) return last.value;
  throw lastError;
}
