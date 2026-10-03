export interface RetryOptions {
  /** Total attempts, including the first. */
  retries: number;
  /** Delay before the second attempt; doubles after each failure. */
  baseMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn` up to `retries` times with exponentially growing pauses; throws the last error. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  { retries, baseMs, sleep = realSleep }: RetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await sleep(baseMs * 2 ** attempt);
    }
  }
  throw lastError;
}
