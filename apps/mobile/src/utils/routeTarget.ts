export type RouteTarget = '/login' | '/onboarding' | '/(tabs)' | '/registering' | '/make-it-yours';

export interface RouteState {
  currentRoute: string;
  isAuthenticated: boolean;
  isSetup: boolean;
  hasOnboarded: boolean;
  setupFlowPending: boolean;
}

const PUBLIC_ROUTES = ['login', 'onboarding'];
const SETUP_ROUTES = ['registering', 'profile-setup', 'make-it-yours'];

/** Where the app must send the person from the screen they are on, or null to leave them be. */
export function routeTarget(state: RouteState): RouteTarget | null {
  const { currentRoute, isAuthenticated, isSetup, hasOnboarded, setupFlowPending } = state;
  const isPublic = PUBLIC_ROUTES.includes(currentRoute);

  if (!isAuthenticated) {
    if (isPublic) return null;
    return hasOnboarded ? '/login' : '/onboarding';
  }
  if (isPublic) {
    if (!isSetup) return '/registering';
    return setupFlowPending ? '/make-it-yours' : '/(tabs)';
  }
  if (!isSetup) return SETUP_ROUTES.includes(currentRoute) ? null : '/registering';
  // A restart mid-flow comes back to it; only the tabs are redirected so no other screen is ever blocked.
  return setupFlowPending && currentRoute === '(tabs)' ? '/make-it-yours' : null;
}
