import { describe, expect, it } from 'vitest';
import type { SessionSummary } from '@/services/trackingSession';
import { recordedRunParams } from '@/utils/recordedRunParams';

const summary: SessionSummary = {
  polyline: 'abc',
  distance: 5000,
  duration: 1500,
  territory: null,
  territoryArea: 0,
  splits: [],
  laps: [],
  bestEfforts: [],
};

describe('recordedRunParams', () => {
  it('carries a simulated-location flag, and leaves it out for a real run', () => {
    expect(recordedRunParams({ ...summary, mocked: true }, 'run').mocked).toBe('1');
    expect(recordedRunParams(summary, 'run').mocked).toBeUndefined();
  });

  it('carries when the run began, and leaves it out when unknown', () => {
    expect(recordedRunParams({ ...summary, startedAt: 1_700_000_000_000 }, 'run').startedAt).toBe(
      '1700000000000'
    );
    expect(recordedRunParams(summary, 'run').startedAt).toBeUndefined();
  });

  it('flags a route that claims no ground and sends no territory', () => {
    const params = recordedRunParams(summary, 'run');

    expect(params.noTerritory).toBe('1');
    expect(params.territory).toBeUndefined();
    expect(params).toMatchObject({ recorded: '1', distance: '5000', duration: '1500' });
  });

  it('sends the closed loop as JSON instead of the flag', () => {
    const ring = [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ] as SessionSummary['territory'];
    const params = recordedRunParams({ ...summary, territory: ring, territoryArea: 42 }, 'ride');

    expect(params.noTerritory).toBeUndefined();
    expect(JSON.parse(params.territory ?? '')).toEqual(ring);
    expect(params).toMatchObject({ activityType: 'ride', territoryArea: '42' });
  });

  it('carries the pace stream as JSON, and omits it when the run has none', () => {
    const stream = { t: [0, 10], speed: [0, 3] };

    expect(JSON.parse(recordedRunParams({ ...summary, stream }, 'run').stream as string)).toEqual(
      stream
    );
    expect(recordedRunParams(summary, 'run').stream).toBeUndefined();
  });

  it('sends the climb and descent when the recording had an altitude, and nothing when it did not', () => {
    const climbing = recordedRunParams({ ...summary, elevationGain: 42, elevationLoss: 40 }, 'run');
    expect(climbing).toMatchObject({ elevationGain: '42', elevationLoss: '40' });

    const flat = recordedRunParams(summary, 'run');
    expect(flat.elevationGain).toBeUndefined();
    expect(flat.elevationLoss).toBeUndefined();
  });
});
