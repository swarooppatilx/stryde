import { describe, expect, it } from 'vitest';
import {
  EMPTY_ACCOUNT_SETUP,
  followNudgeNeeded,
  needsSetupFlow,
  shouldConfirmSkip,
  stepAfter,
  stepBefore,
} from '@/utils/setupFlow';

describe('needsSetupFlow', () => {
  it('is false for an account that never began, so existing accounts are not trapped', () => {
    expect(needsSetupFlow(undefined)).toBe(false);
    expect(needsSetupFlow(EMPTY_ACCOUNT_SETUP)).toBe(false);
  });
  it('is true once begun and until finished', () => {
    expect(needsSetupFlow({ ...EMPTY_ACCOUNT_SETUP, started: true })).toBe(true);
    expect(needsSetupFlow({ ...EMPTY_ACCOUNT_SETUP, started: true, done: true })).toBe(false);
  });
});

describe('steps', () => {
  it('walk forward and back through all four, ending at the edges', () => {
    expect(stepAfter('sports')).toBe('goal');
    expect(stepAfter('permissions')).toBe('people');
    expect(stepAfter('people')).toBeNull();
    expect(stepBefore('people')).toBe('permissions');
    expect(stepBefore('sports')).toBeNull();
  });
});

describe('shouldConfirmSkip', () => {
  it('asks only until the first yes', () => {
    expect(shouldConfirmSkip(false)).toBe(true);
    expect(shouldConfirmSkip(true)).toBe(false);
  });
});

describe('followNudgeNeeded', () => {
  const base = { followingCount: 0, suggestionCount: 5, alreadyShown: false };
  it('nudges once when nobody is followed', () => {
    expect(followNudgeNeeded(base)).toBe(true);
    expect(followNudgeNeeded({ ...base, alreadyShown: true })).toBe(false);
  });
  it('stays quiet when someone is followed or there is nobody to suggest', () => {
    expect(followNudgeNeeded({ ...base, followingCount: 1 })).toBe(false);
    expect(followNudgeNeeded({ ...base, suggestionCount: 0 })).toBe(false);
  });
});
