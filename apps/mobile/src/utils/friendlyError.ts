const UNREACHABLE = "Can't reach the server right now. Check your connection and try again.";
// Raw transport errors and anything carrying a URL say nothing a person can act on.
const TECHNICAL_ERROR =
  /fetch failed|failed to fetch|network request failed|ioexception|econn|enotfound|timed? ?out|aborted|https?:\/\/|localhost/i;

/**
 * A message fit to show a person for a failed call: the error's own words when they are readable,
 * the unreachable wording for a raw network error, and `fallback` when there is nothing to say.
 */
export function friendlyError(
  error: unknown,
  fallback: string,
  unreachable: string = UNREACHABLE
): string {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;
  return TECHNICAL_ERROR.test(error.message) ? unreachable : error.message;
}
