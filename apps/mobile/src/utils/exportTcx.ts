import type { ActivityType } from '@/types';
import type { ExportPoint, ExportTrack } from '@/utils/exportTrack';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** TCX only knows these three; walks, hikes and the rest are "Other". */
const TCX_SPORT: Partial<Record<ActivityType, string>> = { run: 'Running', ride: 'Biking' };

function trackpoint(p: ExportPoint, sport: ActivityType): string {
  const parts = [
    p.timestamp === undefined ? '' : `<Time>${new Date(p.timestamp).toISOString()}</Time>`,
    `<Position><LatitudeDegrees>${p.latitude}</LatitudeDegrees><LongitudeDegrees>${p.longitude}</LongitudeDegrees></Position>`,
    p.altitude === undefined ? '' : `<AltitudeMeters>${p.altitude}</AltitudeMeters>`,
    `<DistanceMeters>${p.distance}</DistanceMeters>`,
    p.heartRate === undefined ? '' : `<HeartRateBpm><Value>${p.heartRate}</Value></HeartRateBpm>`,
  ];
  if (p.cadence !== undefined) {
    parts.push(
      sport === 'ride'
        ? `<Cadence>${p.cadence}</Cadence>`
        : `<Extensions><ns3:TPX><ns3:RunCadence>${p.cadence}</ns3:RunCadence></ns3:TPX></Extensions>`
    );
  }
  return `<Trackpoint>${parts.join('')}</Trackpoint>`;
}

/** The points of each lap: laps cover consecutive stretches of the moving time and the last takes whatever remains. */
function lapSlices(
  track: ExportTrack
): Array<{ start: number; seconds: number; metres: number; points: ExportPoint[] }> {
  const laps =
    track.laps && track.laps.length > 0
      ? track.laps
      : [{ index: 1, distance: track.totalDistanceM, duration: track.totalTimeMs }];
  let start = track.startedAt;
  return laps.map((lap, i) => {
    const from = start;
    const to = start + lap.duration;
    start = to;
    const last = i === laps.length - 1;
    const points = track.points.filter((p) => {
      const at = p.timestamp ?? track.startedAt;
      return at >= from && (last || at < to);
    });
    return { start: from, seconds: lap.duration / 1000, metres: lap.distance, points };
  });
}

/** A TCX 2.0 activity with a trackpoint per route point (position, altitude, distance, heart rate, cadence) and its laps. */
export function exportTcx(track: ExportTrack): string {
  const laps = lapSlices(track)
    .map(
      (lap) => `      <Lap StartTime="${new Date(lap.start).toISOString()}">
        <TotalTimeSeconds>${lap.seconds}</TotalTimeSeconds>
        <DistanceMeters>${lap.metres}</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${lap.points.map((p) => `          ${trackpoint(p, track.sport)}`).join('\n')}
        </Track>
      </Lap>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenter/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
    <Activity Sport="${TCX_SPORT[track.sport] ?? 'Other'}">
      <Id>${new Date(track.startedAt).toISOString()}</Id>
${laps}
      <Notes>${escapeXml(track.name)}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}
