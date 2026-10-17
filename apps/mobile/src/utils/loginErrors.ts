import { isNetworkError } from './errors';

type LoginStep = 'send' | 'verify';

/** A message an athlete can act on, never the provider's raw text. */
export function describeLoginFailure(error: unknown, step: LoginStep): string {
  if (isNetworkError(error)) return "Can't reach the server. Check your connection and try again.";
  const message = error instanceof Error ? error.message : '';
  if (/too many|rate.?limit/i.test(message)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (step === 'verify' && /invalid|incorrect|expired/i.test(message)) {
    return "That code didn't work. Check it, or ask for a new one.";
  }
  return step === 'send'
    ? "Couldn't send the code. Try again."
    : "Couldn't verify the code. Try again.";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Catches typos before a code is requested; the provider has the final say. */
export function isPlausibleEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
