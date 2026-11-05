import { describe, expect, it, vi } from 'vitest';
import { generateLoops, headingWords } from '@/services/loopGenerator';
import type { RoutePoint } from '@/utils/route';

const START: RoutePoint = [73.8567, 18.5204];

/** A fake Directions API whose paths come out `factor` times the straight-line ring. */
function fakeDirections(distanceOf: (call: number) => number) {
  let call = 0;
  return vi.fn(async () => {
    const distance = distanceOf(call++);
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance, geometry: { coordinates: [START, [73.86, 18.53], START] } }],
      }),
    };
  }) as unknown as typeof fetch;
}

describe('generateLoops', () => {
  it('offers three loops, closest to the distance first', async () => {
    const distances = [5100, 6200, 4300];
    const fetchImpl = fakeDirections((n) => distances[n % 3] as number);
    const loops = await generateLoops(START, 5000, 'walking', 0, { token: 'pk.x', fetchImpl });
    expect(loops).toHaveLength(3);
    expect(loops[0]?.distance).toBe(5100);
    for (const loop of loops) {
      expect(loop.waypoints[0]).toEqual(START);
      expect(loop.waypoints.at(-1)).toEqual(START);
    }
  });

  it('redraws a loop that came out far too long, at a smaller size', async () => {
    // First answer 8 km for a 5 km target, then 5.2 km once resized.
    const fetchImpl = fakeDirections((n) => (n === 0 ? 8000 : 5200));
    const [best] = await generateLoops(START, 5000, 'walking', 0, { token: 'pk.x', fetchImpl });
    expect(best?.distance).toBe(5200);
  });

  it('returns nothing when the paths cannot be found', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    expect(await generateLoops(START, 5000, 'walking', 0, { token: 'pk.x', fetchImpl })).toEqual(
      []
    );
  });
});

describe('headingWords', () => {
  it('names the compass direction', () => {
    expect(headingWords(0)).toBe('Heads north');
    expect(headingWords(130)).toBe('Heads south-east');
    expect(headingWords(-90)).toBe('Heads west');
  });
});
