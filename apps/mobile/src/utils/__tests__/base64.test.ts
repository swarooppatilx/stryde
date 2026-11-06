import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from '@/utils/base64';

describe('bytesToBase64', () => {
  it('matches the platform encoder for every padding length', () => {
    for (const bytes of [[], [1], [1, 2], [1, 2, 3], [250, 251, 252, 253, 254, 255]]) {
      expect(bytesToBase64(Uint8Array.from(bytes))).toBe(Buffer.from(bytes).toString('base64'));
    }
  });
});
