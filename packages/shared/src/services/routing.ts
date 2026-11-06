import { apiCall, SocialApiError } from './socialApi';

export type RoutingProfile = 'foot' | 'bike';
export type LngLat = [number, number];

export type SnapResult =
  | { ok: true; coordinates: LngLat[]; distance: number; duration: number }
  | { ok: false; reason: 'no_route' | 'unavailable' | 'not_configured' | 'invalid' };

/**
 * One leg (or a short chain) snapped to the walking or cycling network by the app's routing API.
 * Never throws: the route builder keeps drawing a straight line when this cannot answer, so every
 * failure is a `reason` the caller can show or ignore.
 */
export async function snapRoute(
  profile: RoutingProfile,
  points: readonly LngLat[]
): Promise<SnapResult> {
  if (points.length < 2) return { ok: false, reason: 'invalid' };
  try {
    const data = await apiCall<{ coordinates: LngLat[]; distance: number; duration: number }>(
      'routing',
      'route',
      { method: 'POST', body: JSON.stringify({ profile, points }) }
    );
    return { ok: true, ...data };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('API not configured')) {
      return { ok: false, reason: 'not_configured' };
    }
    if (error instanceof SocialApiError && error.status === 422) {
      return { ok: false, reason: 'no_route' };
    }
    if (error instanceof SocialApiError && error.status === 400) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}

/** Plain copy for route builder errors; null where the builder should not interrupt (no API set up, or a bug of ours). */
export function routingErrorMessage(
  reason: Extract<SnapResult, { ok: false }>['reason']
): string | null {
  if (reason === 'no_route') return "We can't route to this point";
  if (reason === 'unavailable') return 'Something went wrong. Try again later.';
  return null;
}
