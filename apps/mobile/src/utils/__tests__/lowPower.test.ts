import { describe, expect, it } from 'vitest';
import {
  effectiveTrackingProfile,
  LOW_BATTERY_LEVEL,
  sameProfile,
  type TrackingProfileSettings,
} from '@/utils/lowPower';

const best: TrackingProfileSettings = {
  accuracyMode: 'best',
  timeIntervalMs: 1000,
  adjustInBatterySaver: true,
};
const ok = { level: 0.8, lowPowerMode: false, charging: false };

describe('effectiveTrackingProfile', () => {
  it('keeps the chosen profile when the battery is fine', () => {
    expect(effectiveTrackingProfile(best, ok)).toEqual({
      accuracyMode: 'best',
      timeIntervalMs: 1000,
      reason: null,
    });
  });

  it('keeps the chosen profile when the battery cannot be read', () => {
    expect(effectiveTrackingProfile(best, null).reason).toBeNull();
  });

  it('steps down one notch in battery saver', () => {
    expect(effectiveTrackingProfile(best, { ...ok, lowPowerMode: true })).toEqual({
      accuracyMode: 'balanced',
      timeIntervalMs: 3000,
      reason: 'batterySaver',
    });
  });

  it('steps down one notch below the low battery level when unplugged', () => {
    const profile = effectiveTrackingProfile(best, { ...ok, level: LOW_BATTERY_LEVEL - 0.01 });
    expect(profile).toMatchObject({ accuracyMode: 'balanced', reason: 'lowBattery' });
  });

  it('does not step down at exactly the low level, or when charging', () => {
    expect(effectiveTrackingProfile(best, { ...ok, level: LOW_BATTERY_LEVEL }).reason).toBeNull();
    expect(
      effectiveTrackingProfile(best, { ...ok, level: 0.05, charging: true }).reason
    ).toBeNull();
  });

  it('prefers the battery saver reason when both apply', () => {
    const profile = effectiveTrackingProfile(best, {
      level: 0.05,
      lowPowerMode: true,
      charging: false,
    });
    expect(profile.reason).toBe('batterySaver');
  });

  it('stops at the floor and never raises the chosen accuracy', () => {
    const power = { ...best, accuracyMode: 'power' as const, timeIntervalMs: 5000 };
    expect(effectiveTrackingProfile(power, { ...ok, lowPowerMode: true })).toEqual({
      accuracyMode: 'power',
      timeIntervalMs: 5000,
      reason: null,
    });
  });

  it('never makes updates more frequent than the chosen interval', () => {
    const slow = { ...best, accuracyMode: 'balanced' as const, timeIntervalMs: 9000 };
    expect(effectiveTrackingProfile(slow, { ...ok, lowPowerMode: true }).timeIntervalMs).toBe(9000);
  });

  it('does nothing when the athlete turned the adjustment off', () => {
    const off = { ...best, adjustInBatterySaver: false };
    expect(effectiveTrackingProfile(off, { ...ok, lowPowerMode: true }).reason).toBeNull();
  });
});

describe('sameProfile', () => {
  it('compares accuracy and interval only', () => {
    const a = { accuracyMode: 'best', timeIntervalMs: 1000, reason: null } as const;
    expect(sameProfile(a, { ...a, reason: 'batterySaver' })).toBe(true);
    expect(sameProfile(a, { ...a, timeIntervalMs: 3000 })).toBe(false);
  });
});
