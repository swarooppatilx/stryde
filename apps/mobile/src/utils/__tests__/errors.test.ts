import {
  FeeCapTooLowError,
  InsufficientFundsError,
  NonceTooLowError,
  UserRejectedRequestError,
} from 'viem';
import { describe, expect, it } from 'vitest';
import { getParsedError, isNetworkError, isUserRejection } from '../errors';

describe('getParsedError', () => {
  it('returns friendly message for UserRejectedRequestError', () => {
    const err = new UserRejectedRequestError(new Error('user rejected'));
    expect(getParsedError(err)).toBe('Transaction rejected by user');
  });

  it('returns friendly message for InsufficientFundsError', () => {
    const err = new InsufficientFundsError({ value: 1n, unit: 'ether', formattingValue: 1n });
    expect(getParsedError(err)).toBe('Insufficient funds for this transaction');
  });

  it('returns friendly message for NonceTooLowError', () => {
    const err = new NonceTooLowError({ nonce: 0, nextNonce: 1 });
    expect(getParsedError(err)).toBe('Transaction nonce too low — please try again');
  });

  it('returns friendly message for FeeCapTooLowError', () => {
    const err = new FeeCapTooLowError({ chainId: 1, maxFeePerGas: 1n });
    expect(getParsedError(err)).toBe('Gas fee too low — please try again');
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
    expect(getParsedError(err)).toBe(
      "Gasless transactions aren't set up for this app yet — contact support."
    );
  });
});

describe('isUserRejection', () => {
  it('returns true for UserRejectedRequestError', () => {
    const err = new UserRejectedRequestError(new Error('user rejected'));
    expect(isUserRejection(err)).toBe(true);
  });

  it('returns true for Error with "user rejected" in message', () => {
    const err = new Error('user rejected the request');
    expect(isUserRejection(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isUserRejection(new Error('network error'))).toBe(false);
    expect(isUserRejection('not an error')).toBe(false);
    expect(isUserRejection(null)).toBe(false);
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
