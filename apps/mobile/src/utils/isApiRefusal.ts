/** Client errors that a retry could still fix: the request timed out, was too early, or was rate limited. */
const RETRYABLE_CLIENT_ERRORS = new Set([408, 425, 429]);

/** Whether a failed API call was the server saying no for good (a 4xx), rather than an outage worth retrying. */
export function isApiRefusal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { status } = error as { status?: unknown };
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    !RETRYABLE_CLIENT_ERRORS.has(status)
  );
}
