import { describe, expect, it } from 'vitest';
import { isApiRefusal } from '@/utils/isApiRefusal';

const failed = (status: number) => Object.assign(new Error('x'), { status });

describe('isApiRefusal', () => {
  it('counts a client error as the server saying no for good', () => {
    for (const status of [400, 401, 403, 404, 409, 422])
      expect(isApiRefusal(failed(status))).toBe(true);
  });

  it('retries what could pass: timeouts, rate limits, server errors, no response', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504])
      expect(isApiRefusal(failed(status))).toBe(false);
    expect(isApiRefusal(new Error('Network request failed'))).toBe(false);
    expect(isApiRefusal(undefined)).toBe(false);
    expect(isApiRefusal('400')).toBe(false);
  });
});
