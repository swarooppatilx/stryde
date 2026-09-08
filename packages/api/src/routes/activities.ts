import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { keccak256, toBytes } from 'viem';

export const activities = new Hono();

// Mirrors packages/shared/src/services/activity.ts#computeActivityHash exactly —
// the client hashes the same three fields the same way before calling
// ActivityRegistry.recordActivity, and this oracle endpoint must reproduce
// that hash bit-for-bit or contract writes built from it will never match.
// Exported so a test can assert parity against the canonical @repo/shared copy.
export function computeActivityHash(
  polyline: string,
  territoryArea: number,
  metadata: string
): `0x${string}` {
  const data = `${polyline}:${territoryArea}:${metadata}`;
  return keccak256(toBytes(data));
}

// Generous ceilings, not real anti-cheat — just enough to reject obviously
// malformed/absurd input (negative, NaN, or physically-impossible values).
// Full GPS/speed-plausibility validation is a separate piece of work.
const MAX_DISTANCE_METERS = 1_000_000; // 1000km
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_TERRITORY_AREA_SQM = 1_000_000_000; // 1000 sq km
const MAX_POLYLINE_LENGTH = 200_000; // a very long encoded route, generously bounded
const MAX_METADATA_LENGTH = 2_000;

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

activities.post(
  '/validate',
  // Reject oversized bodies before they're buffered/parsed, same defense-in-depth
  // principle as the IPFS route's upload-size check.
  bodyLimit({
    maxSize: 256 * 1024, // 256kb
    onError: (c) => c.json({ valid: false, reason: 'Payload too large' }, 413),
  }),
  async (c) => {
    // This is the trusted oracle endpoint — backend validates before contract recording.
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ valid: false, reason: 'Invalid JSON body' }, 400);
    }

    const { polyline, territoryArea, metadata, distance, duration } = body as Record<
      string,
      unknown
    >;

    if (
      typeof polyline !== 'string' ||
      polyline.length === 0 ||
      polyline.length > MAX_POLYLINE_LENGTH
    ) {
      return c.json({ valid: false, reason: 'polyline is required' }, 400);
    }

    if (!isFiniteNonNegativeNumber(territoryArea) || territoryArea > MAX_TERRITORY_AREA_SQM) {
      return c.json(
        { valid: false, reason: 'territoryArea must be a plausible non-negative number' },
        400
      );
    }

    if (
      metadata !== undefined &&
      (typeof metadata !== 'string' || metadata.length > MAX_METADATA_LENGTH)
    ) {
      return c.json({ valid: false, reason: 'metadata must be a string' }, 400);
    }

    if (!isPositiveFiniteNumber(distance) || distance > MAX_DISTANCE_METERS) {
      return c.json({ valid: false, reason: 'distance must be a plausible positive number' }, 400);
    }

    if (!isPositiveFiniteNumber(duration) || duration > MAX_DURATION_SECONDS) {
      return c.json({ valid: false, reason: 'duration must be a plausible positive number' }, 400);
    }

    const hash = computeActivityHash(
      polyline,
      territoryArea,
      typeof metadata === 'string' ? metadata : ''
    );

    return c.json({ valid: true, hash });
  }
);
