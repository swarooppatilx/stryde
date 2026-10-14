import type { Lap } from '@/types';
import { gpxSportOf, MAX_GPX_BYTES } from '@/utils/gpxParse';
import type { ImportedTrack, TrackPoint } from '@/utils/importTrack';
import { xmlAttribute, xmlChild, xmlNumber, xmlText } from '@/utils/xmlLite';

const MAX_POINTS = 100_000;

function pointOf(inner: string): TrackPoint | null {
  const position = xmlChild(inner, 'Position');
  if (position === undefined) return null;
  const latitude = xmlNumber(position, 'LatitudeDegrees');
  const longitude = xmlNumber(position, 'LongitudeDegrees');
  if (latitude === undefined || longitude === undefined) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const point: TrackPoint = { latitude, longitude };
  const altitude = xmlNumber(inner, 'AltitudeMeters');
  if (altitude !== undefined) point.altitude = altitude;
  const time = Date.parse(xmlText(xmlChild(inner, 'Time') ?? ''));
  if (Number.isFinite(time)) point.timestamp = time;
  const heart = xmlNumber(xmlChild(inner, 'HeartRateBpm') ?? '', 'Value');
  if (heart !== undefined && heart > 0) point.heartRate = heart;
  const cadence = xmlNumber(inner, 'RunCadence') ?? xmlNumber(inner, 'Cadence');
  if (cadence !== undefined && cadence > 0) point.cadence = cadence;
  return point;
}

/** Every activity in a TCX file that has a GPS track, with its heart rate, cadence and laps; null when none does. Read with patterns, because the phone has no XML parser. */
export function tracksFromTcx(xml: string): ImportedTrack[] | null {
  if (xml.length > MAX_GPX_BYTES || !/<TrainingCenterDatabase\b/i.test(xml)) return null;

  const tracks: ImportedTrack[] = [];
  for (const activity of xml.matchAll(/<Activity\b([^>]*)>([\s\S]*?)<\/Activity>/gi)) {
    const points: TrackPoint[] = [];
    const laps: Lap[] = [];

    for (const lap of (activity[2] ?? '').matchAll(/<Lap\b[^>]*>([\s\S]*?)<\/Lap>/gi)) {
      const body = lap[1] ?? '';
      const head = body.split(/<Track\b/i)[0] ?? '';
      const distance = xmlNumber(head, 'DistanceMeters');
      const seconds = xmlNumber(head, 'TotalTimeSeconds');
      if (distance !== undefined && seconds !== undefined) {
        laps.push({ index: laps.length + 1, distance, duration: Math.round(seconds * 1000) });
      }
      for (const found of body.matchAll(/<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi)) {
        const point = pointOf(found[1] ?? '');
        if (point) points.push(point);
        if (points.length >= MAX_POINTS) break;
      }
    }

    if (points.length < 2) continue;
    tracks.push({
      sport: gpxSportOf(xmlAttribute(activity[1] ?? '', 'Sport')),
      points,
      ...(laps.length > 0 && { laps }),
    });
  }
  return tracks.length > 0 ? tracks : null;
}
