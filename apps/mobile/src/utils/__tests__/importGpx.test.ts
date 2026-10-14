import { describe, expect, it } from 'vitest';
import { trackFromGpx } from '@/utils/importGpx';

const point = (i: number, extra = '') =>
  `<trkpt lat="${18.5 + i * 0.0003}" lon="73.8"><ele>${100 + i}</ele><time>2026-10-16T06:00:${String(i * 10).padStart(2, '0')}Z</time><extensions><gpxtpx:TrackPointExtension>${extra}</gpxtpx:TrackPointExtension></extensions></trkpt>`;

const file = (type: string, body: string) =>
  `<gpx><trk><name>Morning loop</name><type>${type}</type><trkseg>${body}</trkseg></trk></gpx>`;

describe('trackFromGpx', () => {
  it('reads the name, sport, points, heart rate and cadence', () => {
    const track = trackFromGpx(
      file('cycling', point(0, '<gpxtpx:hr>120</gpxtpx:hr><gpxtpx:cad>80</gpxtpx:cad>') + point(1))
    );

    expect(track).toMatchObject({ name: 'Morning loop', sport: 'ride' });
    expect(track?.points).toHaveLength(2);
    expect(track?.points[0]).toMatchObject({ heartRate: 120, cadence: 80, altitude: 100 });
  });

  it('is null for a file that is not a usable GPX track', () => {
    expect(trackFromGpx('<html></html>')).toBeNull();
    expect(trackFromGpx(file('running', point(0)))).toBeNull();
  });
});
