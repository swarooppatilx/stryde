import { describe, expect, it } from 'vitest';
import { fixFromCoords } from '@/platform/expo/fixFromCoords';

const base = { latitude: 18.5, longitude: 73.8, accuracy: 6 };

describe('fixFromCoords', () => {
  it('keeps the position, time and accuracy', () => {
    expect(fixFromCoords({ ...base }, 1000)).toEqual({
      latitude: 18.5,
      longitude: 73.8,
      timestamp: 1000,
      accuracy: 6,
    });
  });

  it('keeps what the GPS chip knows about speed, altitude and direction', () => {
    const fix = fixFromCoords(
      { ...base, speed: 3.2, altitude: 560, heading: 90, altitudeAccuracy: 4 },
      1000
    );
    expect(fix).toMatchObject({ speed: 3.2, altitude: 560, bearing: 90, verticalAccuracy: 4 });
  });

  it('leaves a field out when the platform has none, instead of inventing a zero', () => {
    const fix = fixFromCoords(
      { ...base, speed: null, altitude: null, heading: null, altitudeAccuracy: null },
      1000
    );
    expect(fix).not.toHaveProperty('speed');
    expect(fix).not.toHaveProperty('altitude');
    expect(fix).not.toHaveProperty('bearing');
    expect(fix).not.toHaveProperty('verticalAccuracy');
  });

  it('drops a negative speed or heading, which the platform uses to mean "unknown"', () => {
    const fix = fixFromCoords({ ...base, speed: -1, heading: -1 }, 1000);
    expect(fix).not.toHaveProperty('speed');
    expect(fix).not.toHaveProperty('bearing');
  });

  it('treats a missing accuracy as unknown (0), as before', () => {
    expect(fixFromCoords({ latitude: 1, longitude: 2, accuracy: null }, 5).accuracy).toBe(0);
  });
});

describe('fixFromCoords and simulated locations', () => {
  it('marks a fix the phone says is simulated', () => {
    expect(fixFromCoords({ ...base }, 1000, true)).toMatchObject({ mocked: true });
  });

  it('says nothing for a real fix, so ordinary fixes are unchanged', () => {
    expect(fixFromCoords({ ...base }, 1000, false)).not.toHaveProperty('mocked');
    expect(fixFromCoords({ ...base }, 1000)).not.toHaveProperty('mocked');
  });
});
