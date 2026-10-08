import { describe, expect, it, vi } from 'vitest';
import { apiConfigFor } from '@/backends/apiConfig';
import { PROFILES } from '@/backends/profiles';

const base = { apiUrl: 'http://api.test', apiKey: 'k' };

describe('apiConfigFor', () => {
  it('points Live and Local at the real API, with the normal fetch', () => {
    for (const id of ['live', 'local'] as const) {
      const config = apiConfigFor({
        ...base,
        profile: PROFILES[id],
        dev: true,
        sandboxFetch: vi.fn(),
      });

      expect(config).toEqual({ apiUrl: 'http://api.test', apiKey: 'k' });
    }
  });

  it('answers the API on the device in Sandbox, in a development build', () => {
    const fake = vi.fn() as unknown as typeof fetch;

    const config = apiConfigFor({
      ...base,
      profile: PROFILES.sandbox,
      dev: true,
      sandboxFetch: () => fake,
    });

    expect(config.fetch).toBe(fake);
  });

  it('never installs the fake in a release build, whatever the profile', () => {
    const sandboxFetch = vi.fn();

    const config = apiConfigFor({ ...base, profile: PROFILES.sandbox, dev: false, sandboxFetch });

    expect(config.fetch).toBeUndefined();
    expect(sandboxFetch).not.toHaveBeenCalled();
  });
});
