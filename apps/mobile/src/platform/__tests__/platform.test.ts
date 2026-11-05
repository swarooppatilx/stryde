import { afterEach, describe, expect, it } from 'vitest';
import { installFakePlatform, MemoryStorage } from '@/platform/fakes';
import { getPlatform, installPlatform, lazyService, resetPlatform } from '@/platform/index';
import { platformStorage, scopedStorage } from '@/platform/storage';

afterEach(() => resetPlatform());

describe('platform registry', () => {
  it('fails loudly when nothing is installed', () => {
    expect(() => getPlatform()).toThrow(/No platform installed/);
  });

  it('returns whatever was installed last', () => {
    const first = installFakePlatform();
    expect(getPlatform()).toBe(first);
    const second = installFakePlatform();
    expect(getPlatform()).toBe(second);
  });
});

describe('lazyService', () => {
  const build = (platformId: { value: number }) =>
    lazyService((platform) => ({
      id: platformId.value++,
      // proves the service sees the platform it was built from
      now: () => platform.clock.now(),
    }));

  it('builds once, on first use, and binds its methods', () => {
    const counter = { value: 0 };
    const service = build(counter);
    installFakePlatform();
    expect(counter.value).toBe(0);

    const { now } = service;
    expect(typeof now()).toBe('number');
    expect(service.id).toBe(0);
    expect(counter.value).toBe(1);
  });

  it('rebuilds on the next platform so tests never share state', () => {
    const counter = { value: 0 };
    const service = build(counter);

    const a = installFakePlatform();
    a.clock.set(1000);
    expect(service.now()).toBe(1000);

    const b = installFakePlatform();
    b.clock.set(2000);
    expect(service.now()).toBe(2000);
    expect(counter.value).toBe(2);
  });

  it('throws the platform error when used before install', () => {
    const service = build({ value: 0 });
    expect(() => service.now()).toThrow(/No platform installed/);
  });
});

describe('platformStorage', () => {
  it('reads and writes through whichever storage is installed right now', async () => {
    const a = installFakePlatform();
    await platformStorage.setItem('k', 'one');
    expect(a.storage.peek('k')).toBe('one');

    const b = installFakePlatform({ storage: new MemoryStorage() });
    expect(await platformStorage.getItem('k')).toBeNull();
    await platformStorage.setItem('k', 'two');
    expect(b.storage.peek('k')).toBe('two');
    expect(a.storage.peek('k')).toBe('one');
  });
});

describe('scopedStorage', () => {
  it('prefixes keys using the scope at call time', async () => {
    const base = new MemoryStorage();
    let scope = 'sepolia';
    const scoped = scopedStorage(base, () => scope);

    await scoped.setItem('profile', 'a');
    scope = 'local';
    await scoped.setItem('profile', 'b');

    expect(base.keys().sort()).toEqual(['local:profile', 'sepolia:profile']);
    expect(await scoped.getItem('profile')).toBe('b');
    scope = 'sepolia';
    expect(await scoped.getItem('profile')).toBe('a');
    await scoped.removeItem('profile');
    expect(base.keys()).toEqual(['local:profile']);
  });
});

describe('installPlatform', () => {
  it('accepts a hand-built platform', () => {
    const platform = installFakePlatform();
    installPlatform({ ...platform });
    expect(getPlatform().clock).toBe(platform.clock);
  });
});
