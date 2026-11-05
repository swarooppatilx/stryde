import { describe, expect, it } from 'vitest';
import { tracksFromTcx } from '@/utils/importTcx';

const trackpoint = (i: number, extra = '') =>
  `<Trackpoint><Time>2026-10-16T06:00:${String(i * 10).padStart(2, '0')}Z</Time><Position><LatitudeDegrees>${18.5 + i * 0.0003}</LatitudeDegrees><LongitudeDegrees>73.8</LongitudeDegrees></Position><AltitudeMeters>${100 + i}</AltitudeMeters>${extra}</Trackpoint>`;

const lap = (points: string, start = '2026-10-16T06:00:00Z') =>
  `<Lap StartTime="${start}"><TotalTimeSeconds>30</TotalTimeSeconds><DistanceMeters>66.5</DistanceMeters><Track>${points}</Track></Lap>`;

const tcx = (sport: string, laps: string) =>
  `<?xml version="1.0"?><TrainingCenterDatabase xmlns:ns3="x"><Activities><Activity Sport="${sport}"><Id>2026-10-16T06:00:00Z</Id>${laps}</Activity></Activities></TrainingCenterDatabase>`;

describe('tracksFromTcx', () => {
  it('reads points with heart rate and run cadence, and maps the sport', () => {
    const extra =
      '<HeartRateBpm><Value>150</Value></HeartRateBpm><Extensions><ns3:TPX><ns3:RunCadence>82</ns3:RunCadence></ns3:TPX></Extensions>';
    const tracks = tracksFromTcx(tcx('Biking', lap(trackpoint(0, extra) + trackpoint(1))));

    expect(tracks).toHaveLength(1);
    expect(tracks?.[0]?.sport).toBe('ride');
    expect(tracks?.[0]?.points[0]).toMatchObject({
      latitude: 18.5,
      longitude: 73.8,
      altitude: 100,
      heartRate: 150,
      cadence: 82,
      timestamp: Date.parse('2026-10-16T06:00:00Z'),
    });
  });

  it('uses the plain cadence element when there is no extension', () => {
    const tracks = tracksFromTcx(
      tcx('Biking', lap(trackpoint(0, '<Cadence>90</Cadence>') + trackpoint(1)))
    );
    expect(tracks?.[0]?.points[0]?.cadence).toBe(90);
  });

  it('keeps the laps when there is more than one', () => {
    const tracks = tracksFromTcx(
      tcx(
        'Running',
        lap(trackpoint(0) + trackpoint(1)) +
          lap(trackpoint(2) + trackpoint(3), '2026-10-16T06:00:30Z')
      )
    );
    expect(tracks?.[0]?.points).toHaveLength(4);
    expect(tracks?.[0]?.laps).toEqual([
      { index: 1, distance: 66.5, duration: 30_000 },
      { index: 2, distance: 66.5, duration: 30_000 },
    ]);
  });

  it('skips points without a position and returns null without any usable track', () => {
    expect(
      tracksFromTcx(
        tcx('Running', lap('<Trackpoint><Time>2026-10-16T06:00:00Z</Time></Trackpoint>'))
      )
    ).toBeNull();
    expect(tracksFromTcx('<gpx></gpx>')).toBeNull();
  });

  it('reads every activity in the file', () => {
    const one = tcx('Running', lap(trackpoint(0) + trackpoint(1)));
    const two = one.replace(
      '</Activities>',
      `${one.match(/<Activity [\s\S]*<\/Activity>/)?.[0]}</Activities>`
    );
    expect(tracksFromTcx(two)).toHaveLength(2);
  });
});
