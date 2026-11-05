import type { ActivityType } from '@/types';

/** GPX `<type>` values that common importers recognise. */
const GPX_TYPE: Partial<Record<ActivityType, string>> = {
  run: 'running',
  walk: 'walking',
  hike: 'hiking',
  ride: 'cycling',
};

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface GpxInput {
  name: string;
  activityType: ActivityType;
  startedAt: Date;
  route: readonly [number, number][];
  /** Metres above sea level per route point; emitted only when it lines up with `route` exactly (long routes are sampled and failed batches dropped). */
  elevations?: readonly number[];
  /** When the athlete was at each route point; emitted only when aligned with `route`, since importers cannot derive moving time without it. */
  times?: readonly Date[];
}

/** GPX 1.1 track for importing apps, with per-point `<ele>` and `<time>` when aligned series are given. */
export function toGpx({
  name,
  activityType,
  startedAt,
  route,
  elevations,
  times,
}: GpxInput): string | null {
  if (route.length === 0) return null;
  const type = GPX_TYPE[activityType] ?? activityType;
  const aligned = elevations?.length === route.length ? elevations : undefined;
  const timed = times?.length === route.length ? times : undefined;
  const points = route
    .map(([lng, lat], i) => {
      const ele = aligned?.[i];
      const time = timed?.[i];
      const inner =
        (typeof ele === 'number' && Number.isFinite(ele) ? `<ele>${ele}</ele>` : '') +
        (time ? `<time>${time.toISOString()}</time>` : '');
      return inner
        ? `      <trkpt lat="${lat}" lon="${lng}">${inner}</trkpt>`
        : `      <trkpt lat="${lat}" lon="${lng}"/>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Stryde" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${startedAt.toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <type>${escapeXml(type)}</type>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}
