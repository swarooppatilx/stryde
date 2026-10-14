import { describe, expect, it } from 'vitest';
import { toGpx } from '@/utils/gpx';

const route: [number, number][] = [
  [73.8567, 18.5204],
  [73.857, 18.521],
];

describe('toGpx', () => {
  it('writes a GPX 1.1 track with one point per route coordinate, lat/lon in that order', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date('2026-10-16T06:00:00Z'),
      route,
    });

    expect(gpx).toContain('<gpx version="1.1" creator="Stryde"');
    expect(gpx).toContain('<time>2026-10-16T06:00:00.000Z</time>');
    expect(gpx).toContain('<type>running</type>');
    expect(gpx?.match(/<trkpt /g)).toHaveLength(2);
    expect(gpx).toContain('<trkpt lat="18.5204" lon="73.8567"/>');
  });

  it('writes per-point elevation when the series lines up with the route', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date(0),
      route,
      elevations: [560, 562],
    });

    expect(gpx).toContain('<trkpt lat="18.5204" lon="73.8567"><ele>560</ele></trkpt>');
    expect(gpx).toContain('<trkpt lat="18.521" lon="73.857"><ele>562</ele></trkpt>');
    expect(gpx?.match(/<ele>/g)).toHaveLength(2);
  });

  it('omits elevation entirely rather than misaligning a short series', () => {
    // getElevationForRoute() samples long routes and drops failed batches, so a
    // shorter array must not shift its values onto the wrong coordinates.
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date(0),
      route,
      elevations: [560],
    });

    expect(gpx).not.toContain('<ele>');
    expect(gpx).toContain('<trkpt lat="18.5204" lon="73.8567"/>');
  });

  it('skips an individual point whose elevation is not a usable number', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date(0),
      route,
      elevations: [560, Number.NaN],
    });

    expect(gpx).toContain('<trkpt lat="18.5204" lon="73.8567"><ele>560</ele></trkpt>');
    expect(gpx).toContain('<trkpt lat="18.521" lon="73.857"/>');
  });

  it('escapes the activity name', () => {
    const gpx = toGpx({
      name: 'Tom & <Jerry>',
      activityType: 'walk',
      startedAt: new Date(0),
      route,
    });

    expect(gpx).toContain('<name>Tom &amp; &lt;Jerry&gt;</name>');
  });

  it('returns null when there is no route to export', () => {
    expect(toGpx({ name: 'x', activityType: 'run', startedAt: new Date(0), route: [] })).toBeNull();
  });

  it('writes a time on every point when the times line up with the route', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date('2026-10-16T06:00:00Z'),
      route,
      times: [new Date('2026-10-16T06:00:00Z'), new Date('2026-10-16T06:00:10Z')],
    });

    expect(gpx).toContain(
      '<trkpt lat="18.5204" lon="73.8567"><time>2026-10-16T06:00:00.000Z</time></trkpt>'
    );
    expect(gpx).toContain(
      '<trkpt lat="18.521" lon="73.857"><time>2026-10-16T06:00:10.000Z</time></trkpt>'
    );
  });

  it('puts elevation and time together in the order GPX expects', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date(0),
      route,
      elevations: [560, 562],
      times: [new Date(0), new Date(10_000)],
    });

    expect(gpx).toContain(
      '<trkpt lat="18.5204" lon="73.8567"><ele>560</ele><time>1970-01-01T00:00:00.000Z</time></trkpt>'
    );
  });

  it('leaves points without a time rather than misaligning a short list', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date(0),
      route,
      times: [new Date(0)],
    });

    expect(gpx?.match(/<time>/g)).toHaveLength(1); // the metadata time only
  });
});
