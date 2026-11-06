import { isHex } from 'viem';
import { type Address, toAddress } from './address.js';
import type { IntentError } from './intentError.js';

/** A signed intent may be at most this far in the future: long enough for a slow phone, too short to hoard. */
export const MAX_INTENT_LIFETIME_SECONDS = 150;

/** Current unix time in seconds; services take this as an injectable `now` so tests can pin it. */
export const unixNow = () => Math.floor(Date.now() / 1000);

type GuardCode = 'invalid' | 'expired' | 'bad_signature';

/**
 * The checks every signed-intent service runs, bound to that service's own error class so a failure
 * still surfaces as e.g. a FollowError. Each service decides which to call, and in which order.
 */
export function createIntentGuards(fail: (code: GuardCode, message: string) => IntentError) {
  /** The raw request body's intent as a plain record. */
  const record = (raw: unknown): Record<string, unknown> => {
    if (!raw || typeof raw !== 'object') throw fail('invalid', 'intent is required');
    return raw as Record<string, unknown>;
  };

  const deadline = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw fail('invalid', 'deadline must be a unix timestamp in seconds');
    }
    return value;
  };

  const address = (value: unknown, field: string): Address => {
    const wallet = toAddress(value);
    if (!wallet) throw fail('invalid', `${field} must be a wallet address`);
    return wallet;
  };

  const string = (value: unknown, field: string): string => {
    if (typeof value !== 'string') throw fail('invalid', `${field} must be text`);
    return value;
  };

  /** Trimmed text of at most `max` characters that holds none of the `forbidden` characters. */
  const text = (value: unknown, field: string, max: number, forbidden: RegExp): string => {
    const trimmed = string(value, field).trim();
    if (trimmed.length > max) throw fail('invalid', `${field} is at most ${max} characters`);
    if (forbidden.test(trimmed))
      throw fail('invalid', `${field} cannot contain control characters`);
    return trimmed;
  };

  const requireSignature = (signature: unknown): void => {
    if (typeof signature !== 'string' || signature.length === 0) {
      throw fail('invalid', 'signature is required');
    }
  };

  /** The deadline must be neither past nor further out than the allowed lifetime. */
  const requireLiveDeadline = (intentDeadline: number, current: number): void => {
    if (intentDeadline < current || intentDeadline > current + MAX_INTENT_LIFETIME_SECONDS) {
      throw fail('expired', 'The request has expired; try again');
    }
  };

  /** Runs the verifier; nothing may be written before this resolves. `signer` names who must have signed. */
  const requireValidSignature = async <I>(
    verify: (intent: I, signature: string) => Promise<boolean>,
    intent: I,
    signature: string,
    signer: string
  ): Promise<void> => {
    if (!(await verify(intent, signature))) {
      throw fail('bad_signature', `The signature does not match the ${signer}`);
    }
  };

  return {
    record,
    deadline,
    address,
    string,
    text,
    requireSignature,
    requireLiveDeadline,
    requireValidSignature,
  };
}

/** The EIP-712 domain every social intent (follow, like, post, about, report, push) is signed under. Must match the app. */
export const socialDomain = (chainId: number) =>
  ({ name: 'Stryde Social', version: '1', chainId }) as const;

/**
 * Builds the signature check for one intent type from how it is turned into typed data and who must
 * have signed it. The chain client also accepts smart-wallet (ERC-1271) signatures; text that is not
 * even hex is simply "not a signature", while anything else that fails (an RPC outage) must surface.
 */
export function createIntentVerifier<Intent, TypedData extends object>(
  typedData: (intent: Intent, chainId: number) => TypedData,
  signer: (intent: Intent) => `0x${string}`
) {
  return (
    client: {
      verifyTypedData(
        params: TypedData & { address: `0x${string}`; signature: `0x${string}` }
      ): Promise<boolean>;
    },
    chainId: number
  ) =>
    async (intent: Intent, signature: string): Promise<boolean> => {
      if (!isHex(signature)) return false;
      return client.verifyTypedData({
        address: signer(intent),
        signature,
        ...typedData(intent, chainId),
      });
    };
}
