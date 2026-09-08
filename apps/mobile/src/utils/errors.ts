import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  FeeCapTooLowError,
  InsufficientFundsError,
  NonceTooLowError,
  UserRejectedRequestError,
} from 'viem';

// Error class names viem's account-abstraction stack (used under the hood by
// Privy's smart-wallet client, via `permissionless`) throws when a bundler
// rejects a UserOperation because of a paymaster problem — e.g. no paymaster
// policy configured for this app, or the policy declining to sponsor. Some
// of these (e.g. `UserOperationRejectedByPaymasterError`) are constructed
// internally by viem's `getBundlerError` but aren't part of its public
// `viem/account-abstraction` export surface, so we match by `.name` instead
// of `instanceof` to catch all of them, exported or not.
// See node_modules/viem/_esm/account-abstraction/errors/bundler.js and
// .../utils/errors/getBundlerError.js.
const PAYMASTER_ERROR_NAMES = new Set([
  'PaymasterNotDeployedError',
  'PaymasterFunctionRevertedError',
  'PaymasterPostOpFunctionRevertedError',
  'InvalidPaymasterAndDataError',
  'PaymasterDepositTooLowError',
  'PaymasterRateLimitError',
  'PaymasterStakeTooLowError',
  'UserOperationRejectedByPaymasterError',
]);

const GASLESS_NOT_CONFIGURED_MESSAGE =
  "Gasless transactions aren't set up for this app yet — contact support.";

const FRIENDLY_MESSAGES: Record<string, string> = {
  // ChallengeRegistry
  AlreadyAccepted: 'This challenge has already been accepted.',
  AlreadyCancelled: 'This challenge has already been cancelled.',
  AlreadySettled: 'This challenge has already been settled.',
  CannotRefund: 'This challenge cannot be refunded yet.',
  DeadlinePassed: 'The challenge deadline has passed.',
  InvitationOnly: "You're not the invited opponent for this challenge.",
  NotParticipant: "You're not a participant in this challenge.",
  NotSettled: 'This challenge has not been settled yet.',
  OwnChallenge: "You can't challenge yourself.",
  InsufficientBalance: "You don't have enough ETH to cover this transaction.",
  // ProfileRegistry
  AlreadyRegistered: 'This wallet is already registered.',
  NotRegistered: 'This wallet is not registered yet.',
  EmptyUsername: 'Username cannot be empty.',
  UsernameTaken: 'That username is already taken.',
  // ActivityRegistry
  DuplicateHash: 'This activity has already been recorded on-chain.',
  ZeroHash: 'Invalid activity data.',
  // TerritoryRegistry
  EmptyTerritoryId: 'Invalid territory.',
  NotController: "You don't control this territory.",
  Unowned: 'This territory is unclaimed.',
  AlreadyOwned: 'This territory is already claimed by someone else.',
  InvalidArea: 'Invalid territory area.',
  // AchievementRegistry
  EmptyAchievement: 'Invalid achievement.',
  SoulboundTransfer: 'Achievement badges cannot be transferred.',
  // SeasonManager
  SeasonNotActive: 'No season is currently active.',
  SeasonAlreadyActive: 'A season is already active.',
  InvalidDuration: 'Invalid duration.',
  InvalidSeason: 'Invalid season.',
  // Common
  ZeroAddress: 'Invalid (zero) address.',
  EnforcedPause: 'This contract is currently paused.',
  OwnableUnauthorizedAccount: "You're not authorized to perform this action.",
};

/**
 * Turns a viem/contract error into a short, human-readable message.
 * Falls back to viem's shortMessage, then the raw error message.
 */
export function getParsedError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error instanceof UserRejectedRequestError) {
      return 'Transaction rejected by user';
    }
    if (error instanceof InsufficientFundsError) {
      return 'Insufficient funds for this transaction';
    }
    if (error instanceof NonceTooLowError) {
      return 'Transaction nonce too low — please try again';
    }
    if (error instanceof FeeCapTooLowError) {
      return 'Gas fee too low — please try again';
    }
    if (error instanceof ExecutionRevertedError) {
      return `Transaction failed: ${error.shortMessage}`;
    }

    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      if (errorName && FRIENDLY_MESSAGES[errorName]) {
        return FRIENDLY_MESSAGES[errorName];
      }
      if (errorName) {
        return errorName;
      }
    }

    const paymasterError = error.walk(
      (e) => e instanceof Error && PAYMASTER_ERROR_NAMES.has(e.name)
    );
    if (paymasterError) {
      return GASLESS_NOT_CONFIGURED_MESSAGE;
    }

    // Pragmatic fallback in case the bundler/paymaster surfaces a shape we
    // don't recognize above — best-effort match on the word "paymaster".
    if (/paymaster/i.test(error.shortMessage) || /paymaster/i.test(error.message)) {
      return GASLESS_NOT_CONFIGURED_MESSAGE;
    }

    return error.shortMessage;
  }
  if (error instanceof Error) {
    if (/paymaster/i.test(error.message)) {
      return GASLESS_NOT_CONFIGURED_MESSAGE;
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true;
  if (error instanceof BaseError) {
    const match = error.walk((e) => e instanceof UserRejectedRequestError);
    if (match) return true;
  }
  if (error instanceof Error && /user rejected/i.test(error.message)) return true;
  return false;
}

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    /network request failed/i.test(msg) ||
    /econnrefused/i.test(msg) ||
    /econnreset/i.test(msg) ||
    /etimedout/i.test(msg) ||
    /fetch.*failed/i.test(msg) ||
    /timeout/i.test(msg) ||
    /unable to connect/i.test(msg)
  );
}
