import { describe, expect, it } from 'vitest';
import { type RouteState, routeTarget } from '@/utils/routeTarget';

const base: RouteState = {
  currentRoute: '(tabs)',
  isAuthenticated: true,
  isSetup: true,
  hasOnboarded: true,
  setupFlowPending: false,
};
const at = (changes: Partial<RouteState>) => routeTarget({ ...base, ...changes });

describe('routeTarget', () => {
  it('sends a signed-out person to the intro once, then to login', () => {
    expect(at({ isAuthenticated: false, hasOnboarded: false })).toBe('/onboarding');
    expect(at({ isAuthenticated: false })).toBe('/login');
    expect(at({ isAuthenticated: false, currentRoute: 'login' })).toBeNull();
  });

  it('sends a new account to registration, then to Make it yours', () => {
    expect(at({ currentRoute: 'login', isSetup: false })).toBe('/registering');
    expect(at({ isSetup: false })).toBe('/registering');
    expect(at({ isSetup: false, currentRoute: 'profile-setup' })).toBeNull();
    expect(at({ currentRoute: 'login', setupFlowPending: true })).toBe('/make-it-yours');
  });

  it('opens the tabs for an account with nothing pending', () => {
    expect(at({ currentRoute: 'login' })).toBe('/(tabs)');
    expect(at({})).toBeNull();
  });

  it('brings a half-done flow back from the tabs but never traps other screens', () => {
    expect(at({ setupFlowPending: true })).toBe('/make-it-yours');
    expect(at({ setupFlowPending: true, currentRoute: 'make-it-yours' })).toBeNull();
    expect(at({ setupFlowPending: true, currentRoute: 'settings' })).toBeNull();
  });
});
