import { RejectedError } from '@/backends/outbox/outbox';
import { isApiRefusal } from '@/utils/isApiRefusal';
import { revertName } from '@/utils/isContractRevert';

/** A final "no" from the server, carrying its own message so the athlete can see why. */
export function apiRefusal(error: unknown): RejectedError {
  return new RejectedError(error instanceof Error ? error.message : 'Refused');
}

/**
 * For the `catch` of an intent that calls the API. A 4xx is the server saying no for good, so it
 * becomes a rejection the outbox never retries; anything else (network, 5xx, 429) is rethrown to be
 * tried again.
 */
export function refuseApiError(error: unknown): never {
  if (isApiRefusal(error)) throw apiRefusal(error);
  throw error;
}

/** The same for a chain write: a contract revert is a final "no"; a network failure or timeout is left to retry. */
export function refuseContractRevert(error: unknown, what: string): never {
  const name = revertName(error);
  if (name !== null) {
    throw new RejectedError(`The contract refused the ${what}${name ? ` (${name})` : ''}`);
  }
  throw error;
}
