import { describe, expect, it } from 'vitest';
import { isProfileId, PROFILES, resolveProfile } from '@/backends/profiles';

describe('PROFILES', () => {
  it('describes live as the real network and sandbox as fully on-device', () => {
    expect(PROFILES.live).toMatchObject({
      chainMode: 'ethereum-sepolia',
      auth: 'privy',
      fakeApi: false,
      fakeChain: false,
    });
    expect(PROFILES.local).toMatchObject({
      chainMode: 'local',
      auth: 'dev',
      fakeApi: false,
      fakeChain: false,
    });
    expect(PROFILES.sandbox).toMatchObject({ auth: 'dev', fakeApi: true, fakeChain: true });
  });

  it('gives every profile a label and a description to show in the picker', () => {
    for (const profile of Object.values(PROFILES)) {
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.description.length).toBeGreaterThan(0);
    }
  });
});

describe('isProfileId', () => {
  it('accepts only known ids', () => {
    expect(isProfileId('sandbox')).toBe(true);
    expect(isProfileId('prod')).toBe(false);
    expect(isProfileId(undefined)).toBe(false);
  });
});

describe('resolveProfile', () => {
  it('uses the stored choice in a development build', () => {
    expect(resolveProfile({ stored: 'local', devToolsEnabled: true })).toBe('local');
  });

  it('refuses a profile that is not available', () => {
    const original = PROFILES.sandbox.available;
    PROFILES.sandbox.available = false;
    try {
      expect(resolveProfile({ stored: 'sandbox', devToolsEnabled: true })).toBe('live');
    } finally {
      PROFILES.sandbox.available = original;
    }
  });

  it('falls back to live when nothing valid is stored', () => {
    expect(resolveProfile({ stored: null, devToolsEnabled: true })).toBe('live');
    expect(resolveProfile({ stored: 'nonsense', devToolsEnabled: true })).toBe('live');
  });

  it('ignores a stored choice outside development builds, so a release can never leave live', () => {
    expect(resolveProfile({ stored: 'sandbox', devToolsEnabled: false })).toBe('live');
    expect(resolveProfile({ stored: 'local', devToolsEnabled: false })).toBe('live');
  });

  it('opens on the default of the build when nothing usable is stored', () => {
    expect(resolveProfile({ stored: null, devToolsEnabled: true, fallback: 'sandbox' })).toBe(
      'sandbox'
    );
    expect(resolveProfile({ stored: 'nonsense', devToolsEnabled: true, fallback: 'sandbox' })).toBe(
      'sandbox'
    );
  });

  it('prefers a stored choice over the default', () => {
    expect(resolveProfile({ stored: 'live', devToolsEnabled: true, fallback: 'sandbox' })).toBe(
      'live'
    );
  });

  it('is live without developer tools, whatever the default', () => {
    expect(resolveProfile({ stored: 'sandbox', devToolsEnabled: false, fallback: 'sandbox' })).toBe(
      'live'
    );
  });
});
