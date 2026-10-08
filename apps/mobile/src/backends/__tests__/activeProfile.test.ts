import { afterEach, describe, expect, it } from 'vitest';
import {
  activeChainMode,
  getActiveProfileId,
  setActiveProfileId,
  trackBoot,
  whenProfileReady,
} from '@/backends/activeProfile';

afterEach(() => setActiveProfileId('live'));

describe('active profile', () => {
  it('starts as live', () => {
    expect(getActiveProfileId()).toBe('live');
  });

  it('lets a live build keep its own chain mode from its env', () => {
    expect(activeChainMode('local')).toBe('local');
    expect(activeChainMode(undefined)).toBe('ethereum-sepolia');
  });

  it('gives the other profiles their own chain mode regardless of the build', () => {
    setActiveProfileId('sandbox');
    expect(activeChainMode('ethereum-sepolia')).toBe('local');
    setActiveProfileId('local');
    expect(activeChainMode(undefined)).toBe('local');
  });
});

describe('whenProfileReady', () => {
  it('resolves at once when no boot is running', async () => {
    await expect(whenProfileReady()).resolves.toBeUndefined();
  });

  it('waits for a tracked boot, then goes back to immediate', async () => {
    let finish = () => {};
    const boot = trackBoot(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    let ready = false;
    const waiting = whenProfileReady().then(() => {
      ready = true;
    });

    await Promise.resolve();
    expect(ready).toBe(false);

    finish();
    await boot;
    await waiting;
    expect(ready).toBe(true);
  });

  it('does not hang when the boot fails', async () => {
    const boot = trackBoot(Promise.reject(new Error('disk'))).catch(() => {});
    await boot;
    await expect(whenProfileReady()).resolves.toBeUndefined();
  });
});
