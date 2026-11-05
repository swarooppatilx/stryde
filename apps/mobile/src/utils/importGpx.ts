import { gpxSportOf, parseGpx } from '@/utils/gpxParse';
import type { ImportedTrack } from '@/utils/importTrack';

/** The first recorded track of a GPX file as an importable track; null when it has none worth reading. */
export function trackFromGpx(xml: string): ImportedTrack | null {
  const parsed = parseGpx(xml);
  if (!parsed) return null;
  return {
    ...(parsed.name && { name: parsed.name }),
    sport: gpxSportOf(parsed.type),
    points: parsed.points,
  };
}
