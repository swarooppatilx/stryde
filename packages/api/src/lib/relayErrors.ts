import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  FeeCapTooLowError,
  InsufficientFundsError,
  IntrinsicGasTooLowError,
  NonceTooLowError,
  RpcError,
  RpcRequestError,
} from 'viem';

/** A required setting is missing; the service cannot work until an operator fixes it. */
export class ConfigError extends Error {
  constructor(setting: string) {
    super(`Missing configuration: ${setting}`);
    this.name = 'ConfigError';
  }
}

/** A dependency failed in a way that may pass on retry (e.g. an RPC refusing a log range). */
export class RetryLaterError extends Error {
  constructor(cause: unknown) {
    super('Could not read the chain right now; try again shortly', { cause });
    this.name = 'RetryLaterError';
  }
}

export class GasPriceTooHighError extends Error {
  constructor() {
    super('Network gas price is above the relayer cap; try again later');
    this.name = 'GasPriceTooHighError';
  }
}

/** A transaction was sent but is not confirmed (or its status is unknown); it may still land later. */
export class ReceiptTimeoutError extends Error {
  constructor(cause?: unknown) {
    super('The transaction has not been confirmed yet; try again shortly', { cause });
    this.name = 'ReceiptTimeoutError';
  }
}

export interface RelayFailure {
  status: 402 | 403 | 409 | 503;
  message: string;
}

const REVERTS: Record<string, RelayFailure> = {
  SeasonAlreadyActive: {
    status: 409,
    message: 'A season is already active. End it before starting another.',
  },
  AlreadyMinted: { status: 409, message: 'This has already been minted.' },
  DuplicateActivityHash: { status: 409, message: 'This activity has already been rewarded.' },
  TerritoryAlreadyMinted: { status: 409, message: 'This territory has already been minted.' },
  NotSettler: { status: 403, message: 'Relayer is not authorized to settle challenges' },
  AlreadySettled: { status: 409, message: 'This challenge has already been settled.' },
  DeadlineNotPassed: { status: 409, message: 'This challenge is not over yet.' },
  SettleWindowClosed: {
    status: 409,
    message: 'The settle window has closed; both athletes can withdraw their stake.',
  },
  NotRecorder: { status: 403, message: 'Relayer is not authorized to perform this action' },
  OwnableUnauthorizedAccount: {
    status: 403,
    message: 'Relayer is not authorized to perform this action',
  },
  AccessControlUnauthorizedAccount: {
    status: 403,
    message: 'Relayer is not authorized to perform this action',
  },
};

export const MAPPED_REVERTS = Object.keys(REVERTS);

function walkFor<T extends Error>(error: unknown, type: new (...args: never[]) => T): T | null {
  if (!(error instanceof BaseError)) return null;
  const found = error.walk((e) => e instanceof type);
  return found instanceof type ? found : null;
}

/** Turns a failed relayed call into an HTTP-ready answer, or null when it is not recognised. */
export function classifyRelayError(error: unknown): RelayFailure | null {
  if (error instanceof GasPriceTooHighError) return { status: 503, message: error.message };
  if (error instanceof ReceiptTimeoutError) return { status: 503, message: error.message };
  if (error instanceof RetryLaterError) return { status: 503, message: error.message };
  if (error instanceof ConfigError) return { status: 503, message: 'Service misconfigured' };

  const revert = walkFor(error, ContractFunctionRevertedError);
  const known = revert?.data?.errorName ? REVERTS[revert.data.errorName] : undefined;
  if (known) return known;

  if (walkFor(error, InsufficientFundsError)) {
    return { status: 402, message: 'Relayer wallet has insufficient funds for gas' };
  }
  return null;
}

export type ResendFailure = 'nonce-too-low' | 'underpriced' | 'already-known';

/**
 * Recognises the node refusals a fee-bump resend can hit. They mean the original moved on
 * (mined, or the node already holds the transaction) or our bump was too small, so none of
 * them is a reason to fail the relay. Nodes word these differently, hence the text match.
 */
export function classifyResendError(error: unknown): ResendFailure | null {
  if (walkFor(error, NonceTooLowError)) return 'nonce-too-low';
  const text =
    error instanceof Error ? `${error.message} ${(error as BaseError).details ?? ''}` : '';
  if (/nonce too low|nonce is too low/i.test(text)) return 'nonce-too-low';
  if (/underpriced/i.test(text)) return 'underpriced';
  if (/already known|known transaction/i.test(text)) return 'already-known';
  return null;
}

/**
 * Node answers that mean a send was refused before it reached the pool, so nothing can
 * mine later. Anything else (timeouts, dropped connections, unknown errors) is ambiguous:
 * the node may have accepted the transaction and lost the reply.
 */
const REFUSALS: ReadonlyArray<new (...args: never[]) => Error> = [
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  InsufficientFundsError,
  FeeCapTooLowError,
  IntrinsicGasTooLowError,
  RpcRequestError,
  RpcError,
];

export function isDefiniteSendRefusal(error: unknown): boolean {
  // The transport retries a send it thinks was lost, so a "nonce too low" or "already known"
  // answer may be the node reporting our own first attempt: not a refusal.
  if (classifyResendError(error)) return false;
  if (error instanceof ConfigError) return true;
  return REFUSALS.some((type) => walkFor(error, type));
}
