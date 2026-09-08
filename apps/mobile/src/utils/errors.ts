import { BaseError, ContractFunctionRevertedError } from 'viem';

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
    return error.shortMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
