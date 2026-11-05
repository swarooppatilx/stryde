import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) =>
    `stryde://${path}${options?.queryParams ? `?${new URLSearchParams(options.queryParams)}` : ''}`,
}));

const { buildActivityDeepLink, buildProfileDeepLink } = await import('@/utils/deepLink');

describe('deep links', () => {
  it('points an activity at its summary', () => {
    expect(buildActivityDeepLink('abc')).toBe('stryde://activities/abc');
  });

  it("points a profile at the athlete's page", () => {
    expect(buildProfileDeepLink('0xAbC')).toBe('stryde://athletes/0xAbC');
  });
});
