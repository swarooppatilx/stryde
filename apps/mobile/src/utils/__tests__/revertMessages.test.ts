import { describe, expect, it } from 'vitest';
import { FRIENDLY_MESSAGES } from '@/utils/errors';
// Read from source like the API's parity tests: the ABIs are the one list of what a contract can revert with.
import { ABIS } from '../../../../../packages/shared/src/abis';

/** OpenZeppelin plumbing a user's action cannot reach, so showing the raw name is never the problem. */
const INTERNAL = new Set<string>([
  'AccessControlBadConfirmation',
  'ERC20InsufficientAllowance',
  'ERC20InsufficientBalance',
  'ERC20InvalidApprover',
  'ERC20InvalidReceiver',
  'ERC20InvalidSender',
  'ERC20InvalidSpender',
  'ERC721IncorrectOwner',
  'ERC721InsufficientApproval',
  'ERC721InvalidApprover',
  'ERC721InvalidOperator',
  'ERC721InvalidOwner',
  'ERC721InvalidReceiver',
  'ERC721InvalidSender',
  'ERC721NonexistentToken',
  'FailedCall',
  'OwnableInvalidOwner',
  'ReentrancyGuardReentrantCall',
  'StringsInsufficientHexLength',
  'ExpectedPause',
]);

const declaredErrors = [
  ...new Set(
    Object.values(ABIS).flatMap((abi) =>
      abi.flatMap((entry) => (entry.type === 'error' ? [entry.name] : []))
    )
  ),
].sort();

describe('revert messages', () => {
  it('every error a contract can raise has a message a person can read', () => {
    const missing = declaredErrors.filter(
      (name) => !INTERNAL.has(name) && !FRIENDLY_MESSAGES[name]
    );

    expect(missing).toEqual([]);
  });

  it('does not keep messages for errors no contract has any more', () => {
    const known = new Set<string>(declaredErrors);
    // Errors the contracts do not declare yet, so they are not in the ABIs until that change ships.
    const PENDING_PATCHES = new Set([
      'NotSettler',
      'DeadlineNotPassed',
      'SettleWindowClosed',
      'NullifierAlreadyUsed',
      'NameTooLong',
      'LocationTooLong',
      'DescriptionTooLong',
      'TitleTooLong',
      'CidTooLong',
    ]);
    const stale = Object.keys(FRIENDLY_MESSAGES).filter(
      (name) => !known.has(name) && !PENDING_PATCHES.has(name)
    );

    expect(stale).toEqual([]);
  });
});
