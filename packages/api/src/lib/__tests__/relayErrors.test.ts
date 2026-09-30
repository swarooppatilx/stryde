import { describe, expect, it } from 'vitest';
import { outOfGas, revertedWith } from '../../test-utils/viemErrors.js';
import { RELAY_ABIS } from '../relayAbis.js';
import {
  ConfigError,
  classifyRelayError,
  classifyResendError,
  GasPriceTooHighError,
  isDefiniteSendRefusal,
  MAPPED_REVERTS,
  ReceiptTimeoutError,
  RetryLaterError,
} from '../relayErrors.js';

describe('classifyRelayError', () => {
  it.each([
    ['SeasonAlreadyActive', 409],
    ['NotRecorder', 403],
    ['OwnableUnauthorizedAccount', 403],
    ['AlreadyMinted', 409],
  ] as const)('maps the contract error %s to %i', (name, status) => {
    expect(classifyRelayError(revertedWith(name))?.status).toBe(status);
  });

  it('does not guess at a revert it does not know', () => {
    expect(classifyRelayError(revertedWith('Unmapped'))).toBeNull();
  });

  it('answers 503 for a chain read worth retrying', () => {
    expect(classifyRelayError(new RetryLaterError(new Error('pruned history')))?.status).toBe(503);
  });

  it('answers 402 when the relayer cannot pay for gas', () => {
    expect(classifyRelayError(outOfGas())?.status).toBe(402);
  });

  it('answers 503 for the fee cap and for missing configuration', () => {
    expect(classifyRelayError(new GasPriceTooHighError())?.status).toBe(503);
    expect(classifyRelayError(new ConfigError('RELAYER_PRIVATE_KEY'))?.status).toBe(503);
  });

  it('does not read meaning into free-form text', () => {
    expect(classifyRelayError(new Error('caller is not the owner'))).toBeNull();
    expect(classifyRelayError('boom')).toBeNull();
  });
});

// viem can only name a revert whose error is in the ABI it called with; a mapped
// error missing from every relay ABI surfaces as a generic 400 in production.
describe('relay ABIs', () => {
  const declared = new Set<string>(
    Object.values(RELAY_ABIS).flatMap((abi) =>
      abi.flatMap((item) => (item.type === 'error' ? [item.name] : []))
    )
  );

  it.each(MAPPED_REVERTS)('declare %s so the revert can be decoded', (name) => {
    expect(declared.has(name)).toBe(true);
  });

  it('declare the reward contract duplicate-activity error', () => {
    expect(
      RELAY_ABIS.moveToEarnToken.some(
        (item) => item.type === 'error' && item.name === 'DuplicateActivityHash'
      )
    ).toBe(true);
  });
});

describe('classifyResendError', () => {
  it.each([
    ['nonce too low: next nonce 8', 'nonce-too-low'],
    ['replacement transaction underpriced', 'underpriced'],
    ['already known', 'already-known'],
  ])('recognises "%s"', (message, kind) => {
    expect(classifyResendError(new Error(message))).toBe(kind);
  });

  it('leaves other failures alone', () => {
    expect(classifyResendError(new Error('boom'))).toBeNull();
  });
});

describe('ReceiptTimeoutError', () => {
  it('is answered as a retryable 503', () => {
    expect(classifyRelayError(new ReceiptTimeoutError())?.status).toBe(503);
  });
});

describe('isDefiniteSendRefusal', () => {
  it('is true for a revert and for insufficient funds', () => {
    expect(isDefiniteSendRefusal(revertedWith('NotRecorder'))).toBe(true);
    expect(isDefiniteSendRefusal(outOfGas())).toBe(true);
    expect(isDefiniteSendRefusal(new ConfigError('RELAYER_PRIVATE_KEY'))).toBe(true);
  });

  it('is false for timeouts, unknown errors and answers a transport retry can produce', () => {
    expect(isDefiniteSendRefusal(new Error('socket hang up'))).toBe(false);
    expect(isDefiniteSendRefusal(new Error('nonce too low'))).toBe(false);
    expect(isDefiniteSendRefusal(new Error('already known'))).toBe(false);
  });
});
