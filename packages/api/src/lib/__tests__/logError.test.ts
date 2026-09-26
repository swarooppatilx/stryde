import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, redact } from '../logError.js';

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/abc123SECRETkey';

describe('redact', () => {
  it('removes a configured secret wherever it appears', () => {
    const env = { RELAYER_RPC_URL: RPC, PORT: '3000' };

    expect(redact(`HTTP request failed. URL: ${RPC} Details: x ${RPC}`, env)).toBe(
      'HTTP request failed. URL: [redacted] Details: x [redacted]'
    );
  });

  it('removes a key that appears inside a longer URL', () => {
    const env = { PINATA_JWT_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.payload' };

    expect(redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload', env)).toBe(
      'Authorization: Bearer [redacted]'
    );
  });

  it('leaves ordinary settings and short values alone', () => {
    const env = { PORT: '3000', API_KEY: 'short', NODE_ENV: 'production' };

    expect(redact('listening on 3000 in production, key short', env)).toBe(
      'listening on 3000 in production, key short'
    );
  });
});

describe('logError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the stack without the RPC key', () => {
    const previous = process.env.RELAYER_RPC_URL;
    process.env.RELAYER_RPC_URL = RPC;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('[relay]', new Error(`HTTP request failed. URL: ${RPC}`));

    const output = log.mock.calls.flat().join(' ');
    expect(output).toContain('[relay]');
    expect(output).toContain('HTTP request failed');
    expect(output).not.toContain('abc123SECRETkey');
    if (previous === undefined) delete process.env.RELAYER_RPC_URL;
    else process.env.RELAYER_RPC_URL = previous;
  });

  it('copes with a thrown non-error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('[x]', 'plain string');

    expect(log).toHaveBeenCalledWith('[x]', 'plain string');
  });
});
