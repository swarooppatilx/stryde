import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  encodeErrorResult,
  FeeCapTooLowError,
  HttpRequestError,
  InsufficientFundsError,
  NonceTooLowError,
  UserRejectedRequestError,
} from 'viem';
import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import { FRIENDLY_MESSAGES, getParsedError, isNetworkError } from '@/utils/errors';

describe('getParsedError', () => {
  it('returns friendly message for UserRejectedRequestError', () => {
    const err = new UserRejectedRequestError(new Error('user rejected'));
    expect(getParsedError(err)).toBe('You cancelled that');
  });

  it('returns friendly message for InsufficientFundsError', () => {
    const err = new InsufficientFundsError({});
    expect(getParsedError(err)).toBe("You don't have enough funds for that");
  });

  it('returns friendly message for NonceTooLowError', () => {
    const err = new NonceTooLowError({ nonce: 0 });
    expect(getParsedError(err)).toBe('That did not go through. Please try again');
  });

  it('returns friendly message for FeeCapTooLowError', () => {
    const err = new FeeCapTooLowError({ maxFeePerGas: 1n });
    expect(getParsedError(err)).toBe('That did not go through. Please try again');
  });

  it('returns shortMessage for generic Error', () => {
    const err = new Error('something broke');
    expect(getParsedError(err)).toBe('something broke');
  });

  it('returns fallback for unknown value', () => {
    expect(getParsedError('oops')).toBe('Something went wrong. Please try again.');
    expect(getParsedError(null)).toBe('Something went wrong. Please try again.');
    expect(getParsedError(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('returns gasless message for paymaster error in message text', () => {
    const err = new Error('paymaster rejected');
    expect(getParsedError(err)).toBe("Saving isn't set up for this app yet. Contact support.");
  });
});

describe('isNetworkError', () => {
  it('returns true for "Network request failed"', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
  });

  it('returns true for ECONNREFUSED', () => {
    expect(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:3000'))).toBe(true);
  });

  it('returns true for ECONNRESET', () => {
    expect(isNetworkError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isNetworkError(new Error('connect ETIMEDOUT'))).toBe(true);
  });

  it('returns true for "fetch failed"', () => {
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
  });

  it('returns true for "timeout"', () => {
    expect(isNetworkError(new Error('request timeout'))).toBe(true);
  });

  it('returns true for "unable to connect"', () => {
    expect(isNetworkError(new Error('unable to connect to server'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isNetworkError(new Error('insufficient funds'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNetworkError('not an error')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('what people read', () => {
  it('never speaks of wallets, gas, transactions or the chain in a mapped contract message', () => {
    for (const [name, message] of Object.entries(FRIENDLY_MESSAGES)) {
      expect(message, name).not.toMatch(BANNED_USER_WORDS);
    }
  });

  it('keeps the fixed viem messages clear of those words too', () => {
    const errors = [
      new UserRejectedRequestError(new Error('x')),
      new InsufficientFundsError({}),
      new NonceTooLowError({ nonce: 0 }),
      new FeeCapTooLowError({ maxFeePerGas: 1n }),
      new Error('paymaster rejected'),
    ];
    for (const error of errors) expect(getParsedError(error)).not.toMatch(BANNED_USER_WORDS);
  });
});

describe('raw technical text never reaches people', () => {
  const GENERIC = 'Something went wrong. Please try again.';

  const revertWith = (errorName: string) => {
    const abi = [{ type: 'error', name: errorName, inputs: [] }] as const;
    const revert = new ContractFunctionRevertedError({
      abi,
      functionName: 'register',
      data: encodeErrorResult({ abi, errorName }),
    });
    return new BaseError('The contract function "register" reverted.', { cause: revert });
  };

  it('does not show the name of a contract error nobody wrote a message for', () => {
    expect(getParsedError(revertWith('SomeNewContractError'))).toBe(GENERIC);
  });

  it('still shows a mapped contract error as its friendly text', () => {
    expect(getParsedError(revertWith('ZeroAddress'))).toBe(FRIENDLY_MESSAGES.ZeroAddress);
  });

  it('turns a failed request into a plain connection message, not viem’s wording', () => {
    const error = new HttpRequestError({ url: 'http://127.0.0.1:8545', details: 'fetch failed' });

    expect(getParsedError(error)).toBe(
      "Can't reach the network. Check your connection and try again."
    );
  });

  it('replaces an error whose text carries URLs, hex or request dumps', () => {
    for (const message of [
      'HTTP request failed.\n\nURL: http://127.0.0.1:8545/\nRequest body: {"method":"eth_call"}',
      'execution reverted: custom error 0x05b94333',
      'Details: fetch failed\nVersion: viem@2.56.3',
    ]) {
      expect(getParsedError(new Error(message)), message).not.toContain('0x05b9');
      expect(getParsedError(new Error(message)), message).not.toMatch(/URL:|viem|Request body/);
    }
  });

  it('keeps a short sentence an app author wrote for people', () => {
    expect(getParsedError(new Error('That username is taken'))).toBe('That username is taken');
  });

  it('treats a very long message as a dump, not something to read', () => {
    expect(getParsedError(new Error('x'.repeat(400)))).toBe(GENERIC);
  });
});

describe('how each kind of failure reads', () => {
  const GENERIC = 'Something went wrong. Please try again.';
  const GASLESS = "Saving isn't set up for this app yet. Contact support.";
  const CONNECTION = "Can't reach the network. Check your connection and try again.";

  it('names what a reverted execution refused', () => {
    const error = new ExecutionRevertedError({ message: 'execution reverted: Not allowed' });

    expect(getParsedError(error)).toBe(`That didn't go through: ${error.shortMessage}`);
  });

  it('recognises a paymaster failure by its error name inside a wrapped error', () => {
    const inner = new Error('bundler said no');
    inner.name = 'PaymasterDepositTooLowError';

    expect(getParsedError(new BaseError('Could not send.', { cause: inner }))).toBe(GASLESS);
  });

  it('recognises a paymaster failure by its wording in a wrapped error', () => {
    expect(getParsedError(new BaseError('The paymaster refused it.'))).toBe(GASLESS);
  });

  it('shows the short message of a wrapped error when it reads like a sentence', () => {
    expect(getParsedError(new BaseError('That name is taken'))).toBe('That name is taken');
  });

  it('replaces the short message of a wrapped error when it is technical', () => {
    expect(getParsedError(new BaseError('execution reverted: custom error 0x05b94333'))).toBe(
      GENERIC
    );
  });

  it('reports a plain network failure as a connection problem', () => {
    expect(getParsedError(new Error('Network request failed'))).toBe(CONNECTION);
  });

  it('reports a wrapped timeout as a connection problem', () => {
    const timeout = new Error('slow');
    timeout.name = 'TimeoutError';

    expect(getParsedError(new BaseError('Request timed out.', { cause: timeout }))).toBe(
      CONNECTION
    );
  });
});
