import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  FeeCapTooLowError,
  InsufficientFundsError,
  NonceTooLowError,
  UserRejectedRequestError,
} from 'viem';
import { logger } from '@/utils/logger';

// viem's account-abstraction stack throws these when a bundler rejects a UserOperation over a paymaster problem. Some are not exported from `viem/account-abstraction`, so they are matched by `.name` instead of `instanceof`.
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

const GASLESS_NOT_CONFIGURED_MESSAGE = "Saving isn't set up for this app yet. Contact support.";

export const FRIENDLY_MESSAGES: Record<string, string> = {
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
  InsufficientBalance: "You don't have enough funds to cover that.",
  // ProfileRegistry
  AlreadyRegistered: 'This account is already registered.',
  NotRegistered: 'This account is not registered yet.',
  EmptyUsername: 'Username cannot be empty.',
  UsernameTaken: 'That username is already taken.',
  // ActivityRegistry
  DuplicateHash: 'This activity has already been saved.',
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
  // ActivityRegistry (more)
  ActivityNotFound: "That activity doesn't exist.",
  NotActivityOwner: 'You can only change activities you recorded.',
  InvalidActivityType: 'That activity type is not supported.',
  EmptyActivityHash: 'Invalid activity data.',
  DuplicateActivityHash: 'This activity has already been rewarded.',
  ZeroDistance: 'This activity has no distance to reward.',
  // SocialRegistry
  DuplicateComment: 'That comment was already posted.',
  // TerritoryRegistry / TerritoryNFT
  EmptyPolygonHash: 'Invalid territory.',
  AlreadyMinted: 'This territory already has its NFT.',
  TerritoryAlreadyMinted: 'This territory already has its NFT.',
  TerritoryNotMinted: "This territory doesn't have an NFT yet.",
  // GroupRegistry
  EmptyName: 'Give it a name.',
  GroupNotFound: "That club doesn't exist any more.",
  AlreadyMember: "You're already a member of this club.",
  NotMember: "You're not a member of this club.",
  NotGroupOwner: 'Only the club owner can do that.',
  NewOwnerNotMember: 'The new owner must already be a member of the club.',
  OwnerMustTransferOwnershipFirst: 'Hand the club to another member before you leave.',
  InsufficientTreasuryBalance: "The club treasury doesn't hold that much.",
  TreasuryTransferFailed: 'The treasury payment could not be sent.',
  ZeroAmount: 'Enter an amount above zero.',
  // EventRegistry
  EmptyTitle: 'Give the event a title.',
  EventNotFound: "That event doesn't exist or was cancelled.",
  AlreadyJoined: "You've already joined this event.",
  NotHost: 'Only the host can do that.',
  EventEnded: 'This event has already ended.',
  InvalidTimeRange: 'The event must end after it starts.',
  HostMustCancelFirst: 'The host has to cancel the event before leaving it.',
  // ProfileRegistry (more)
  UsernameTooLong: 'That username is too long (32 characters at most).',
  AlreadyVerified: 'This account is already verified.',
  NotAuthorizedVerifier: "You're not authorized to verify accounts.",
  // MoveToEarnToken
  RewardRateTooHigh: 'That reward rate is above the allowed maximum.',
  // Roles
  NotRecorder: "You're not authorized to record contributions.",
  AccessControlUnauthorizedAccount: "You're not authorized to perform this action.",
  // Errors the contracts do not declare yet; unused until that change is deployed.
  NotSettler: 'Only the challenge settler can name a winner.',
  DeadlineNotPassed: "The challenge isn't over yet.",
  SettleWindowClosed: 'The time to settle this challenge has passed. Take your stake back instead.',
  NullifierAlreadyUsed: 'This World ID has already verified another account.',
  NameTooLong: 'That name is too long.',
  LocationTooLong: 'That location is too long.',
  DescriptionTooLong: 'That description is too long.',
  TitleTooLong: 'That title is too long.',
  CidTooLong: 'That reference is too long.',
  // Common
  ZeroAddress: 'Invalid (zero) address.',
  EnforcedPause: 'This is paused for a moment. Try again shortly.',
  OwnableUnauthorizedAccount: "You're not authorized to perform this action.",
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const CONNECTION_MESSAGE = "Can't reach the network. Check your connection and try again.";
/** Beyond this a message is a dump (a request, a stack), not a sentence written for people. */
const MAX_READABLE_LENGTH = 140;
const TECHNICAL_TEXT =
  /0x[0-9a-f]{8,}|\b(URL|Request body|Request Arguments|Raw Call Arguments|Details|Version|Docs):|viem@|json-?rpc|\bHTTP request failed|execution reverted|custom error|\n/i;

/** The message as written, when it reads like a sentence for people; null when it is technical text. */
function readable(message: string): string | null {
  const text = message.trim();
  if (text === '' || text.length > MAX_READABLE_LENGTH || TECHNICAL_TEXT.test(text)) return null;
  return text;
}

/** A request that never got an answer: viem's HTTP/timeout errors and the usual fetch failures. */
function isConnectionFailure(error: unknown): boolean {
  if (error instanceof BaseError) {
    const hit = error.walk(
      (e) => e instanceof Error && /^(HttpRequestError|TimeoutError)$/.test(e.name)
    );
    if (hit) return true;
  }
  return isNetworkError(error);
}

/**
 * Turns an error into a short sentence for people. Anything technical (an unmapped contract error
 * name, viem's own wording, a request dump) becomes a plain message and is logged instead, so the
 * detail is still there for whoever debugs it.
 */
export function getParsedError(error: unknown): string {
  const message = parseError(error);
  if (error instanceof Error && message !== error.message) {
    logger.warn('[Error] Showed a plain message for:', error.message);
  }
  return message;
}

const RETRY_MESSAGE = 'That did not go through. Please try again';

/** viem errors with one fixed sentence, checked in this order. */
const FIXED_VIEM_MESSAGES: ReadonlyArray<[new (...args: never[]) => BaseError, string]> = [
  [UserRejectedRequestError, 'You cancelled that'],
  [InsufficientFundsError, "You don't have enough funds for that"],
  [NonceTooLowError, RETRY_MESSAGE],
  [FeeCapTooLowError, RETRY_MESSAGE],
];

const mentionsPaymaster = (text: string) => /paymaster/i.test(text);

/** The message for a contract revert, or null when the revert carries no error name. */
function revertMessage(error: BaseError): string | null {
  const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (!(revertError instanceof ContractFunctionRevertedError)) return null;
  const errorName = revertError.data?.errorName;
  if (!errorName) return null;
  // An error name nobody wrote a message for is a code name, not something to show.
  return FRIENDLY_MESSAGES[errorName] ?? GENERIC_MESSAGE;
}

function isPaymasterFailure(error: BaseError): boolean {
  if (error.walk((e) => e instanceof Error && PAYMASTER_ERROR_NAMES.has(e.name))) return true;
  // Best-effort match on "paymaster" for bundler error shapes not matched by name.
  return mentionsPaymaster(error.shortMessage) || mentionsPaymaster(error.message);
}

function parseViemError(error: BaseError): string {
  const fixed = FIXED_VIEM_MESSAGES.find(([kind]) => error instanceof kind);
  if (fixed) return fixed[1];
  if (error instanceof ExecutionRevertedError) {
    return `That didn't go through: ${error.shortMessage}`;
  }
  const revert = revertMessage(error);
  if (revert) return revert;
  if (isPaymasterFailure(error)) return GASLESS_NOT_CONFIGURED_MESSAGE;
  if (isConnectionFailure(error)) return CONNECTION_MESSAGE;
  return readable(error.shortMessage) ?? GENERIC_MESSAGE;
}

function parseError(error: unknown): string {
  if (error instanceof BaseError) return parseViemError(error);
  if (!(error instanceof Error)) return GENERIC_MESSAGE;
  if (mentionsPaymaster(error.message)) return GASLESS_NOT_CONFIGURED_MESSAGE;
  if (isConnectionFailure(error)) return CONNECTION_MESSAGE;
  return readable(error.message) ?? GENERIC_MESSAGE;
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

/** True when location failed because the phone's GPS/location services are switched off. */
export function isLocationServicesOff(error: unknown): boolean {
  return error instanceof Error && error.message.includes('unsatisfied device settings');
}
