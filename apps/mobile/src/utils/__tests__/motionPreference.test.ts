import { describe, expect, it } from 'vitest';
import { MOTION_OPTIONS, shouldReduceMotion } from '@/utils/motionPreference';

describe('shouldReduceMotion', () => {
  it('follows the phone in Auto: still when the phone asks for less motion', () => {
    expect(shouldReduceMotion('auto', true)).toBe(true);
    expect(shouldReduceMotion('auto', false)).toBe(false);
  });

  it('is always reduced when the athlete chose Reduced, whatever the phone says', () => {
    expect(shouldReduceMotion('reduced', false)).toBe(true);
    expect(shouldReduceMotion('reduced', true)).toBe(true);
  });
});

describe('MOTION_OPTIONS', () => {
  it('offers Auto and Reduced, in plain words', () => {
    expect(MOTION_OPTIONS.map((o) => o.value)).toEqual(['auto', 'reduced']);
    expect(MOTION_OPTIONS.map((o) => o.label)).toEqual(['Auto', 'Reduced']);
  });
});
