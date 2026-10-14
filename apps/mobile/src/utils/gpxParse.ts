import type { ActivityType } from '@/types';
import {
  xmlNumberAttribute as attribute,
  xmlChild as child,
  xmlText as text,
  xmlNumber,
} from '@/utils/xmlLite';

/** A file bigger than this (characters) is not read: a recorded track is a few hundred kilobytes. */
export const MAX_GPX_BYTES = 8 * 1024 * 1024;
/** Points past this are dropped, so a hostile file cannot make the import run for ever. */
const MAX_GPX_POINTS = 100_000;

export interface GpxPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Milliseconds since the epoch; absent when the point has no readable time. */
  timestamp?: number;
  /** Beats per minute, from the Garmin-style track-point extension. */
  heartRate?: number;
  /** Revolutions or strides per minute, from the same extension. */
  cadence?: number;
}

export interface ParsedGpx {
  name?: string;
  /** The track's own `<type>` text, for `gpxSportOf`. */
  type?: string;
  points: GpxPoint[];
}

function pointOf(attributes: string, inner: string): GpxPoint | null {
  const latitude = attribute(attributes, 'lat');
  const longitude = attribute(attributes, 'lon');
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const point: GpxPoint = { latitude, longitude };
  const ele = Number(child(inner, 'ele'));
  if (child(inner, 'ele') !== undefined && Number.isFinite(ele)) point.altitude = ele;
  const time = Date.parse(text(child(inner, 'time') ?? ''));
  if (Number.isFinite(time)) point.timestamp = time;
  const hr = xmlNumber(inner, 'hr');
  if (hr !== undefined && hr > 0) point.heartRate = hr;
  const cad = xmlNumber(inner, 'cad');
  if (cad !== undefined && cad > 0) point.cadence = cad;
  return point;
}

/** First recorded track in a GPX file with elevation, time and heart rate where given; waypoints and planned routes are ignored. Null for non-GPX, oversize or fewer than two usable points. Parsed with patterns, not an XML parser, because the phone has none. */
export function parseGpx(xml: string): ParsedGpx | null {
  if (xml.length > MAX_GPX_BYTES || !/<gpx\b/i.test(xml)) return null;

  const points: GpxPoint[] = [];
  let name: string | undefined;
  let type: string | undefined;

  for (const block of xml.matchAll(/<trk\b[^>]*>([\s\S]*?)<\/trk>/gi)) {
    const body = block[1] ?? '';
    const head = body.split(/<trkseg\b/i)[0] ?? '';
    name ??= child(head, 'name') === undefined ? undefined : text(child(head, 'name') as string);
    type ??= child(head, 'type') === undefined ? undefined : text(child(head, 'type') as string);

    for (const found of body.matchAll(/<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/gi)) {
      const point = pointOf(found[1] ?? '', found[2] ?? '');
      if (point) points.push(point);
      if (points.length >= MAX_GPX_POINTS) break;
    }
  }

  if (points.length < 2) return null;
  return { ...(name && { name }), ...(type && { type }), points };
}

/** The sport a GPX `<type>` word names; a run when it says nothing useful. */
export function gpxSportOf(type: string | undefined): ActivityType {
  const word = (type ?? '').toLowerCase();
  if (/cycl|bik|ride/.test(word)) return 'ride';
  if (/hik/.test(word)) return 'hike';
  if (/walk/.test(word)) return 'walk';
  return 'run';
}
