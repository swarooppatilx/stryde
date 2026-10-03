import { getChainConfig } from '@repo/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setActiveProfileId, trackBoot } from '@/backends/activeProfile';
import { type FakePlatform, installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';
import { chainScopedStorageAdapter, isoDateReviver } from '@/utils/storage';

describe('isoDateReviver', () => {
  it('converts ISO date strings to Date objects', () => {
    const iso = '2024-06-15T10:30:00.000Z';
    const result = isoDateReviver('key', iso);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe(iso);
  });

  it('returns non-date strings as-is', () => {
    expect(isoDateReviver('key', 'hello')).toBe('hello');
    expect(isoDateReviver('key', '2024-06-15')).toBe('2024-06-15');
  });

  it('returns non-string values as-is', () => {
    expect(isoDateReviver('key', 42)).toBe(42);
    expect(isoDateReviver('key', null)).toBe(null);
    expect(isoDateReviver('key', { nested: true })).toEqual({ nested: true });
  });

  it('returns boolean values as-is', () => {
    expect(isoDateReviver('key', true)).toBe(true);
    expect(isoDateReviver('key', false)).toBe(false);
  });

  it('ignores ISO-like strings without milliseconds', () => {
    expect(isoDateReviver('key', '2024-06-15T10:30:00Z')).toBe('2024-06-15T10:30:00Z');
  });
});

describe('chainScopedStorageAdapter', () => {
  let platform: FakePlatform;

  beforeEach(() => {
    platform = installFakePlatform();
  });

  afterEach(() => {
    setActiveProfileId('live');
    uninstallFakePlatform();
    delete process.env.EXPO_PUBLIC_CHAIN_MODE;
  });

  const registry = (mode: 'ethereum-sepolia' | 'local') =>
    getChainConfig(mode).contracts.profileRegistry.toLowerCase();

  it('keeps live data under the key it always used', async () => {
    await chainScopedStorageAdapter.setItem('@stryde/x', '1');

    expect(
      platform.storage.peek(`ethereum-sepolia:${registry('ethereum-sepolia')}:@stryde/x`)
    ).toBe('1');
  });

  it('keeps each non-live profile in its own scope, even on the same chain mode', async () => {
    setActiveProfileId('sandbox');
    await chainScopedStorageAdapter.setItem('@stryde/x', 'sandbox');
    setActiveProfileId('local');
    await chainScopedStorageAdapter.setItem('@stryde/x', 'local');

    expect(platform.storage.peek(`sandbox:local:${registry('local')}:@stryde/x`)).toBe('sandbox');
    expect(platform.storage.peek(`local:local:${registry('local')}:@stryde/x`)).toBe('local');
  });

  it('holds reads until the profile has finished loading, so a store never hydrates the wrong scope', async () => {
    await chainScopedStorageAdapter.setItem('@stryde/x', 'live-value');
    let finish = () => {};
    const boot = trackBoot(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    let read: string | null | undefined;
    const reading = chainScopedStorageAdapter.getItem('@stryde/x').then((v) => {
      read = v;
    });
    await Promise.resolve();
    expect(read).toBeUndefined();

    setActiveProfileId('local');
    finish();
    await boot;
    await reading;
    expect(read).toBeNull();
  });
});
