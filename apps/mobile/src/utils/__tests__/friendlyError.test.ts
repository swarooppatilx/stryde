import { describe, expect, it } from 'vitest';
import { friendlyError } from '@/utils/friendlyError';

const OFFLINE = "Can't reach the server right now. Check your connection and try again.";

describe('friendlyError', () => {
  it('keeps a readable message', () => {
    expect(friendlyError(new Error('Name already taken'), 'Could not save')).toBe(
      'Name already taken'
    );
  });

  it.each([
    'fetch failed: java.io.IOException: unexpected end of stream on http://localhost:3000/...',
    'Network request failed',
    'Failed to fetch',
    'Request timed out',
    'connect ECONNREFUSED 127.0.0.1:3000',
    'Bad gateway at https://api.example.com/x',
  ])('hides a technical error: %s', (message) => {
    expect(friendlyError(new Error(message), 'Could not save')).toBe(OFFLINE);
  });

  it('uses the fallback when there is no message', () => {
    expect(friendlyError('boom', 'Could not save')).toBe('Could not save');
    expect(friendlyError(new Error('  '), 'Could not save')).toBe('Could not save');
  });

  it('lets the caller word the unreachable case', () => {
    expect(friendlyError(new Error('Failed to fetch'), 'x', 'Offline')).toBe('Offline');
  });
});
