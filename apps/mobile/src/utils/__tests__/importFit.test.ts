import { describe, expect, it } from 'vitest';
import { trackFromFit } from '@/utils/importFit';
import { encoder, FIT_EPOCH_S, type FieldSpec, fitFile } from './fitEncoder';

const START_S = Math.floor(Date.parse('2026-10-16T06:00:00Z') / 1000) - FIT_EPOCH_S;
const DEG = 2 ** 31 / 180;

const RECORD: FieldSpec[] = [
  [253, 'uint32'],
  [0, 'sint32'],
  [1, 'sint32'],
  [2, 'uint16'],
  [3, 'uint8'],
  [4, 'uint8'],
];
const SESSION: FieldSpec[] = [
  [253, 'uint32'],
  [2, 'uint32'],
  [5, 'enum'],
  [6, 'enum'],
  [8, 'uint32'],
  [9, 'uint32'],
];
const LAP: FieldSpec[] = [
  [8, 'uint32'],
  [9, 'uint32'],
];

const lat = (i: number) => Math.round((18.5 + i * 0.0003) * DEG);
const lon = Math.round(73.8 * DEG);

function recordBody(le: boolean, count = 4) {
  const e = encoder(le);
  const body = [...e.definition(0, 20, RECORD)];
  for (let i = 0; i < count; i++) {
    body.push(
      ...e.data(0, RECORD, [START_S + i * 10, lat(i), lon, (100 + i + 500) * 5, 150 + i, 80])
    );
  }
  return { e, body };
}

function session(e: ReturnType<typeof encoder>, sport: number, sub = 0, distanceM = 0) {
  return [
    ...e.definition(1, 18, SESSION),
    ...e.data(1, SESSION, [START_S + 40, START_S, sport, sub, 40_000, distanceM * 100]),
  ];
}

describe('trackFromFit', () => {
  it('reads records into points, converting units and the FIT epoch', () => {
    const { e, body } = recordBody(true);
    const result = trackFromFit(fitFile([...body, ...session(e, 1)]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.track.sport).toBe('run');
    expect(result.track.points).toHaveLength(4);
    expect(result.track.points[1]).toMatchObject({
      altitude: 101,
      heartRate: 151,
      cadence: 80,
      timestamp: (START_S + 10 + FIT_EPOCH_S) * 1000,
    });
    expect(result.track.points[0]?.latitude).toBeCloseTo(18.5, 6);
    expect(result.track.points[0]?.longitude).toBeCloseTo(73.8, 6);
  });

  it('reads a 12-byte header', () => {
    const { body } = recordBody(true);
    expect(trackFromFit(fitFile(body, { headerSize: 12 })).ok).toBe(true);
  });

  it('reads a big-endian file', () => {
    const { e, body } = recordBody(false);
    const result = trackFromFit(fitFile([...body, ...session(e, 2)]));
    expect(result.ok && result.track.sport).toBe('ride');
    expect(result.ok && result.track.points[3]?.latitude).toBeCloseTo(18.5009, 6);
  });

  it('rolls compressed timestamps forward, across the 32 second wrap', () => {
    const e = encoder();
    const fields: FieldSpec[] = RECORD.slice(1);
    const at = START_S - (START_S % 32) + 30;
    const body = [
      ...e.definition(0, 20, RECORD),
      ...e.data(0, RECORD, [at, lat(0), lon, null, null, null]),
      ...e.definition(1, 20, fields),
      ...e.compressed(1, 31, fields, [lat(1), lon, null, null, null]),
      ...e.compressed(1, 3, fields, [lat(2), lon, null, null, null]),
    ];
    const result = trackFromFit(fitFile(body));
    const times = result.ok
      ? result.track.points.map((p) => (p.timestamp ?? 0) / 1000 - FIT_EPOCH_S)
      : [];
    expect(times).toEqual([at, at + 1, at + 5]);
  });

  it('skips developer fields', () => {
    const e = encoder();
    const body = [
      ...e.definition(0, 20, RECORD, 3),
      ...e.data(0, RECORD, [START_S, lat(0), lon, null, null, null], [9, 9, 9]),
      ...e.data(0, RECORD, [START_S + 10, lat(1), lon, null, null, null], [9, 9, 9]),
    ];
    const result = trackFromFit(fitFile(body));
    expect(result.ok && result.track.points).toHaveLength(2);
  });

  it('leaves invalid values out and drops records without a position', () => {
    const e = encoder();
    const body = [
      ...e.definition(0, 20, RECORD),
      ...e.data(0, RECORD, [START_S, lat(0), lon, null, null, null]),
      ...e.data(0, RECORD, [START_S + 5, null, null, null, 140, 80]),
      ...e.data(0, RECORD, [START_S + 10, lat(1), lon, null, 0, 0]),
    ];
    const result = trackFromFit(fitFile(body));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.track.points).toHaveLength(2);
    expect(result.track.points[0]).not.toHaveProperty('altitude');
    expect(result.track.points[0]).not.toHaveProperty('heartRate');
    expect(result.track.points[1]).not.toHaveProperty('cadence');
  });

  it('prefers the enhanced altitude', () => {
    const e = encoder();
    const fields: FieldSpec[] = [...RECORD.slice(0, 3), [78, 'uint32']];
    const body = [
      ...e.definition(0, 20, fields),
      ...e.data(0, fields, [START_S, lat(0), lon, (250 + 500) * 5]),
      ...e.data(0, fields, [START_S + 1, lat(1), lon, (251 + 500) * 5]),
    ];
    const result = trackFromFit(fitFile(body));
    expect(result.ok && result.track.points.map((p) => p.altitude)).toEqual([250, 251]);
  });

  it('reads laps', () => {
    const { e, body } = recordBody(true);
    const laps = [
      ...e.definition(2, 19, LAP),
      ...e.data(2, LAP, [20_000, 50_000]),
      ...e.data(2, LAP, [21_500, 52_000]),
    ];
    const result = trackFromFit(fitFile([...body, ...laps]));
    expect(result.ok && result.track.laps).toEqual([
      { index: 1, distance: 500, duration: 20_000 },
      { index: 2, distance: 520, duration: 21_500 },
    ]);
  });

  it('rejects a corrupt file with a reason', () => {
    const { body } = recordBody(true);
    expect(trackFromFit(fitFile(body, { corruptCrc: true }))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
    const bytes = fitFile(body);
    expect(trackFromFit(bytes.slice(0, bytes.length - 9))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });

  it('rejects bytes that are not a FIT file', () => {
    expect(trackFromFit(new TextEncoder().encode('<gpx></gpx>'))).toEqual({
      ok: false,
      reason: 'unreadable',
    });
    expect(trackFromFit(new Uint8Array())).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('keeps distance and time from the session of an indoor activity', () => {
    const e = encoder();
    const body = session(e, 4, 1, 5_000);
    const result = trackFromFit(fitFile(body));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.track.sport).toBe('run');
    expect(result.track.points).toEqual([]);
    expect(result.track.summary).toMatchObject({
      startTime: (START_S + FIT_EPOCH_S) * 1000,
      durationMs: 40_000,
      distanceM: 5_000,
    });
  });

  it('maps sports and falls back to a workout for unknown ones', () => {
    const sportOf = (sport: number, sub = 0) => {
      const e = encoder();
      const result = trackFromFit(fitFile(session(e, sport, sub, 100)));
      return result.ok ? result.track.sport : null;
    };
    expect(sportOf(11)).toBe('walk');
    expect(sportOf(17)).toBe('hike');
    expect(sportOf(5)).toBe('swim');
    expect(sportOf(4, 6)).toBe('ride');
    expect(sportOf(4, 20)).toBe('workout');
    expect(sportOf(200)).toBe('workout');
  });
});
