import type { MapMarker } from '@/components/map-route';
import type { Brand } from '@/constants/theme';
import type { Activity } from '@/types';
import type { LngLatPair } from '@/utils/mapData';
import { type SplitMarker, splitMarkers } from '@/utils/splitMarkers';

/** The kilometre pins along the route; only the owner's copy is the whole route, a shared one may have its ends cut, which would shift every pin. */
export function ownerSplitPins(
  splits: Activity['splits'],
  coordinates: readonly LngLatPair[],
  isOwner: boolean
): SplitMarker[] | undefined {
  if (!isOwner || !splits || splits.length < 2) return undefined;
  const total = splits.reduce((sum, s) => sum + s.distance, 0);
  return splitMarkers(coordinates, splits[0]?.distance ?? 0, total);
}

export function routeMarkers(
  coordinates: readonly LngLatPair[],
  scrubCursor: LngLatPair | null,
  brand: Pick<typeof Brand, 'success' | 'danger' | 'primary'>
): MapMarker[] {
  const list: MapMarker[] = [];
  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (first && last) {
    list.push({ id: 'start', coordinate: first, color: brand.success, icon: 'play' });
    list.push({ id: 'end', coordinate: last, color: brand.danger, icon: 'stop' });
  }
  if (scrubCursor) {
    list.push({ id: 'scrub', coordinate: scrubCursor, color: brand.primary });
  }
  return list;
}
