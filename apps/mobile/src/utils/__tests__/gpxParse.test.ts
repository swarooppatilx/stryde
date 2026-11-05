import { describe, expect, it } from 'vitest';
import { toGpx } from '@/utils/gpx';
import { gpxSportOf, MAX_GPX_BYTES, parseGpx } from '@/utils/gpxParse';

const track = (points: string, extra = '') => `<?xml version="1.0"?>
<gpx version="1.1" creator="Other" xmlns="http://www.topografix.com/GPX/1/1"
 xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata><name>Metadata name</name></metadata>
  <trk><name>Lunch &amp; hill</name><type>running</type>${extra}
    <trkseg>${points}</trkseg>
  </trk>
</gpx>`;

describe('parseGpx', () => {
  it('reads points with position, elevation and time, in order', () => {
    const parsed = parseGpx(
      track(
        `<trkpt lat="18.52" lon="73.85"><ele>560.5</ele><time>2026-10-16T06:00:00Z</time></trkpt>
         <trkpt lat="18.53" lon="73.86"><ele>561</ele><time>2026-10-16T06:00:10Z</time></trkpt>`
      )
    );

    expect(parsed?.points).toEqual([
      {
        latitude: 18.52,
        longitude: 73.85,
        altitude: 560.5,
        timestamp: Date.parse('2026-10-16T06:00:00Z'),
      },
      {
        latitude: 18.53,
        longitude: 73.86,
        altitude: 561,
        timestamp: Date.parse('2026-10-16T06:00:10Z'),
      },
    ]);
  });

  it('takes the track name and decodes entities', () => {
    const parsed = parseGpx(track('<trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/>'));

    expect(parsed?.name).toBe('Lunch & hill');
    expect(parsed?.type).toBe('running');
  });

  it('accepts either attribute order and single quotes', () => {
    const parsed = parseGpx(track(`<trkpt lon='2' lat='1'/><trkpt lon="2.1" lat="1.1"/>`));

    expect(parsed?.points.map((p) => [p.latitude, p.longitude])).toEqual([
      [1, 2],
      [1.1, 2.1],
    ]);
  });

  it('reads a heart rate from the track-point extension, with any namespace prefix', () => {
    const parsed = parseGpx(
      track(
        `<trkpt lat="1" lon="2"><time>2026-10-16T06:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>141</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
         <trkpt lat="1.1" lon="2.1"><time>2026-10-16T06:00:05Z</time><extensions><ns3:TrackPointExtension><ns3:hr>150</ns3:hr></ns3:TrackPointExtension></extensions></trkpt>`
      )
    );

    expect(parsed?.points.map((p) => p.heartRate)).toEqual([141, 150]);
  });

  it('joins several segments into one track', () => {
    const xml = `<gpx><trk><trkseg><trkpt lat="1" lon="2"/></trkseg><trkseg><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>`;

    expect(parseGpx(xml)?.points).toHaveLength(2);
  });

  it('skips points with coordinates that are not on the Earth, and unreadable times', () => {
    const parsed = parseGpx(
      track(
        `<trkpt lat="91" lon="2"/><trkpt lat="1" lon="181"/><trkpt lat="1" lon="2"><time>soon</time></trkpt><trkpt lat="1.1" lon="2.1"/>`
      )
    );

    expect(parsed?.points).toHaveLength(2);
    expect(parsed?.points[0]?.timestamp).toBeUndefined();
  });

  it('ignores waypoints and route points: only a recorded track is an activity', () => {
    const xml = `<gpx><wpt lat="1" lon="2"/><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>`;

    expect(parseGpx(xml)).toBeNull();
  });

  it('is null for fewer than two points, for text that is not GPX, and for a file that is too big', () => {
    expect(parseGpx(track('<trkpt lat="1" lon="2"/>'))).toBeNull();
    expect(parseGpx('hello')).toBeNull();
    expect(parseGpx('<html></html>')).toBeNull();
    expect(parseGpx(`<gpx>${' '.repeat(MAX_GPX_BYTES)}</gpx>`)).toBeNull();
  });

  it('reads back what this app writes', () => {
    const gpx = toGpx({
      name: 'Morning Run',
      activityType: 'run',
      startedAt: new Date('2026-10-16T06:00:00Z'),
      route: [
        [73.8567, 18.5204],
        [73.857, 18.521],
      ],
      elevations: [560, 561.5],
      times: [new Date('2026-10-16T06:00:00Z'), new Date('2026-10-16T06:00:30Z')],
    }) as string;

    const parsed = parseGpx(gpx);

    expect(parsed?.name).toBe('Morning Run');
    expect(gpxSportOf(parsed?.type)).toBe('run');
    expect(parsed?.points[1]).toEqual({
      latitude: 18.521,
      longitude: 73.857,
      altitude: 561.5,
      timestamp: Date.parse('2026-10-16T06:00:30Z'),
    });
  });
});

describe('gpxSportOf', () => {
  it('maps the common type words to a sport', () => {
    expect(gpxSportOf('running')).toBe('run');
    expect(gpxSportOf('Trail Running')).toBe('run');
    expect(gpxSportOf('cycling')).toBe('ride');
    expect(gpxSportOf('biking')).toBe('ride');
    expect(gpxSportOf('hiking')).toBe('hike');
    expect(gpxSportOf('walking')).toBe('walk');
  });

  it('falls back to a run, the commonest, when it says nothing useful', () => {
    expect(gpxSportOf(undefined)).toBe('run');
    expect(gpxSportOf('9')).toBe('run');
  });
});
