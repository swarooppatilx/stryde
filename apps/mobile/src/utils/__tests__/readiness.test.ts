import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import {
  LOW_STORAGE_BYTES,
  type ReadinessInput,
  readinessChecks,
  readinessRows,
  readOrNull,
} from '@/utils/readiness';

const GOOD: ReadinessInput = {
  location: { granted: true, precise: true },
  backgroundLocation: true,
  servicesOn: true,
  notifications: true,
  freeStorageBytes: 5 * 1024 ** 3,
};
const statusOf = (input: ReadinessInput, id: string) =>
  readinessChecks(input).find((c) => c.id === id)?.status;

describe('readinessChecks', () => {
  it('is all ok except the static battery tip when everything is fine', () => {
    const checks = readinessChecks(GOOD);
    expect(checks.filter((c) => c.status !== 'ok').map((c) => c.id)).toEqual(['battery']);
    expect(readinessRows(checks)).toEqual([]);
  });

  it('never reports battery as ok or warn', () => {
    expect(statusOf(GOOD, 'battery')).toBe('tip');
    expect(statusOf({ ...GOOD, notifications: false }, 'battery')).toBe('tip');
  });

  it('blocks without location permission', () => {
    const input = { ...GOOD, location: { granted: false } };
    expect(statusOf(input, 'location')).toBe('blocked');
  });

  it('warns for approximate-only location', () => {
    expect(statusOf({ ...GOOD, location: { granted: true, precise: false } }, 'location')).toBe(
      'warn'
    );
  });

  it('warns for foreground-only location, not when unreadable', () => {
    expect(statusOf({ ...GOOD, backgroundLocation: false }, 'location')).toBe('warn');
    expect(statusOf({ ...GOOD, backgroundLocation: null }, 'location')).toBe('ok');
  });

  it('blocks when location services are off, offering the location settings', () => {
    const c = readinessChecks({ ...GOOD, servicesOn: false }).find((x) => x.id === 'services');
    expect(c?.status).toBe('blocked');
    expect(c?.action?.kind).toBe('openLocationSettings');
  });

  it('warns when notifications are denied, and trusts an unreadable answer', () => {
    expect(statusOf({ ...GOOD, notifications: false }, 'notifications')).toBe('warn');
    expect(statusOf({ ...GOOD, notifications: null }, 'notifications')).toBe('ok');
  });

  it('warns under 200 MB free only', () => {
    expect(statusOf({ ...GOOD, freeStorageBytes: LOW_STORAGE_BYTES - 1 }, 'storage')).toBe('warn');
    expect(statusOf({ ...GOOD, freeStorageBytes: LOW_STORAGE_BYTES }, 'storage')).toBe('ok');
    expect(statusOf({ ...GOOD, freeStorageBytes: null }, 'storage')).toBe('ok');
  });

  it('orders blocked, then warn, then tip, then ok', () => {
    const checks = readinessChecks({
      location: { granted: true, precise: false },
      backgroundLocation: true,
      servicesOn: false,
      notifications: false,
      freeStorageBytes: 1,
    });
    expect(checks.map((c) => c.status)).toEqual(['blocked', 'warn', 'warn', 'warn', 'tip']);
    expect(checks.map((c) => c.id)).toEqual([
      'services',
      'location',
      'notifications',
      'storage',
      'battery',
    ]);
  });
});

describe('readOrNull', () => {
  it('turns a rejection or throw into null, so the checks never warn on it', async () => {
    expect(await readOrNull(() => Promise.reject(new Error('no')))).toBeNull();
    expect(
      await readOrNull(() => {
        throw new Error('no');
      })
    ).toBeNull();
    expect(await readOrNull(async () => true)).toBe(true);
    const failed = {
      location: await readOrNull(() => Promise.reject(new Error('no'))),
      backgroundLocation: null,
      servicesOn: await readOrNull(() => Promise.reject(new Error('no'))),
      notifications: null,
      freeStorageBytes: null,
    };
    expect(readinessRows(readinessChecks(failed))).toEqual([]);
  });
});

describe('readinessRows', () => {
  it('shows problems with the tip beside them, never ok rows', () => {
    const rows = readinessRows(readinessChecks({ ...GOOD, notifications: false }));
    expect(rows.map((r) => r.id)).toEqual(['notifications', 'battery']);
  });

  it('uses plain words', () => {
    const all = readinessChecks({
      location: { granted: false },
      backgroundLocation: false,
      servicesOn: false,
      notifications: false,
      freeStorageBytes: 0,
    });
    for (const c of all) expect(`${c.title} ${c.detail}`).not.toMatch(BANNED_USER_WORDS);
  });
});
