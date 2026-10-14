import { describe, expect, it } from 'vitest';
import { activityInputFromGpx } from '@/services/gpxImport';

const START = Date.parse('2026-10-16T06:00:00Z');
const iso = (offsetS: number) => new Date(START + offsetS * 1000).toISOString();
const M_PER_DEG = 111_320;

/** A straight run north at 3 m/s, one point every 10 s, with a climb and a heart rate. */
function gpx({
  points = 7,
  withTimes = true,
  type = 'running',
  name = 'Hill repeats',
}: {
  points?: number;
  withTimes?: boolean;
  type?: string;
  name?: string;
} = {}) {
  const body = Array.from({ length: points }, (_, i) => {
    const lat = 18.5 + (i * 30) / M_PER_DEG;
    return `<trkpt lat="${lat}" lon="73.8"><ele>${100 + i * 3}</ele>${
      withTimes ? `<time>${iso(i * 10)}</time>` : ''
    }<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + i}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`;
  }).join('');
  return `<gpx><trk><name>${name}</name><type>${type}</type><trkseg>${body}</trkseg></trk></gpx>`;
}

describe('activityInputFromGpx', () => {
  it('turns a timed track into a manual-marked activity with its time, distance and sport', () => {
    const result = activityInputFromGpx(gpx());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      title: 'Hill repeats',
      activityType: 'run',
      duration: 60_000,
      isManual: true,
      startedAt: START,
    });
    expect(result.input.distance).toBeGreaterThan(170);
    expect(result.input.distance).toBeLessThan(190);
    expect(result.input.polyline.length).toBeGreaterThan(0);
    expect(result.input.description).toBe('Imported from a GPX file');
  });

  it('keeps the heart rate as a series and an average', () => {
    const result = activityInputFromGpx(gpx());

    if (!result.ok) throw new Error('expected ok');
    expect(result.input.heartRate).toEqual({ avg: 143, max: 146 });
    expect(result.input.stream?.heartRate?.bpm).toEqual([140, 141, 142, 143, 144, 145, 146]);
  });

  it('reads the sport from the track type', () => {
    const result = activityInputFromGpx(gpx({ type: 'cycling' }));

    if (!result.ok) throw new Error('expected ok');
    expect(result.input.activityType).toBe('ride');
  });

  it('gives an identity that is the same for the same track, so it is not imported twice', () => {
    const a = activityInputFromGpx(gpx());
    const b = activityInputFromGpx(gpx());
    const c = activityInputFromGpx(gpx({ points: 5 }));

    if (!a.ok || !b.ok || !c.ok) throw new Error('expected ok');
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
  });

  it('refuses a track without times: moving time and splits cannot be worked out', () => {
    expect(activityInputFromGpx(gpx({ withTimes: false }))).toEqual({
      ok: false,
      reason: 'no-times',
    });
  });

  it('refuses text that is not a track', () => {
    expect(activityInputFromGpx('hello')).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses a track that goes nowhere', () => {
    const still = `<gpx><trk><trkseg><trkpt lat="18.5" lon="73.8"><time>${iso(0)}</time></trkpt><trkpt lat="18.5" lon="73.8"><time>${iso(60)}</time></trkpt></trkseg></trk></gpx>`;

    expect(activityInputFromGpx(still)).toEqual({ ok: false, reason: 'too-short' });
  });

  it('refuses a track whose times run backwards', () => {
    const backwards = `<gpx><trk><trkseg><trkpt lat="18.5" lon="73.8"><time>${iso(60)}</time></trkpt><trkpt lat="18.51" lon="73.8"><time>${iso(0)}</time></trkpt></trkseg></trk></gpx>`;

    expect(activityInputFromGpx(backwards)).toEqual({ ok: false, reason: 'no-times' });
  });
});
