import { describe, expect, it } from 'vitest';
import { inElevationBand, routeDifficulty } from '@/utils/routeDifficulty';

describe('routeDifficulty', () => {
  it('calls a short flat route easy', () => {
    expect(routeDifficulty({ distance: 3_000, elevationGain: 10, sport: 'run' })).toBe('easy');
  });

  it('counts climbing: the same distance is harder with 400 m of ascent', () => {
    const flat = routeDifficulty({ distance: 10_000, elevationGain: 20, sport: 'run' });
    const hilly = routeDifficulty({ distance: 10_000, elevationGain: 400, sport: 'run' });

    expect(flat).toBe('moderate');
    expect(hilly).toBe('hard');
  });

  it('calls a long route hard even when flat', () => {
    expect(routeDifficulty({ distance: 30_000, elevationGain: 50, sport: 'run' })).toBe('hard');
  });

  it('weighs a ride’s distance lightly, since 20 km is an easy spin on a bike', () => {
    expect(routeDifficulty({ distance: 20_000, elevationGain: 80, sport: 'ride' })).toBe('easy');
    expect(routeDifficulty({ distance: 20_000, elevationGain: 80, sport: 'run' })).toBe('hard');
  });

  it('says nothing when the climb is unknown, rather than guessing from distance alone', () => {
    expect(routeDifficulty({ distance: 5_000, sport: 'run' })).toBeNull();
  });

  it('keeps the boundaries inclusive on the harder side', () => {
    expect(routeDifficulty({ distance: 8_000, elevationGain: 0, sport: 'run' })).toBe('moderate');
    expect(routeDifficulty({ distance: 15_000, elevationGain: 0, sport: 'run' })).toBe('hard');
    expect(routeDifficulty({ distance: 14_900, elevationGain: 0, sport: 'run' })).toBe('moderate');
  });
});

describe('inElevationBand', () => {
  it('lets every route through for any', () => {
    expect(inElevationBand('any', undefined)).toBe(true);
    expect(inElevationBand('any', 500)).toBe(true);
  });

  it('splits flat, rolling and hilly by total climb', () => {
    expect(inElevationBand('flat', 49)).toBe(true);
    expect(inElevationBand('flat', 50)).toBe(false);
    expect(inElevationBand('rolling', 50)).toBe(true);
    expect(inElevationBand('rolling', 199)).toBe(true);
    expect(inElevationBand('hilly', 200)).toBe(true);
  });

  it('keeps out a route whose climb is unknown once a band is chosen', () => {
    expect(inElevationBand('flat', undefined)).toBe(false);
    expect(inElevationBand('hilly', undefined)).toBe(false);
  });
});
