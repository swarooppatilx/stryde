import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import type { CameraMove, SegmentPin } from '@/components/map-route';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useOnline } from '@/hooks/useOnline';
import { nearbySegments, type Segment } from '@/services/arkivService';
import { exploreSegments } from '@/services/segmentExplore';
import { starredList, useSegmentStarsStore } from '@/stores/segmentStarsStore';
import { boundsFromCamera } from '@/utils/geohashCells';
import { logger } from '@/utils/logger';

const SETTLE_MS = 700;
/** Zoomed out further than this the view is a country, not somewhere to look for segments. */
const MIN_ZOOM = 9;

interface View {
  center: [number, number];
  zoom: number;
}

/**
 * The segment gates to draw on the Map tab: starred ones always, plus whatever the nearby query
 * finds for the cells under the view once the camera settles. Offline, or switched off, only the
 * starred ones show and nothing is requested.
 */
export function useMapSegments(
  enabled: boolean,
  start: [number, number] | null
): { pins: SegmentPin[]; onCameraMove: (move: CameraMove) => void } {
  const online = useOnline();
  const { width, height } = useWindowDimensions();
  const starred = useSegmentStarsStore((s) => s.starred);
  const [view, setView] = useState<View | null>(null);
  const [found, setFound] = useState<Segment[]>([]);
  const startLng = start?.[0];
  const startLat = start?.[1];
  const target = useMemo<View | null>(() => {
    if (view) return view;
    if (startLng === undefined || startLat === undefined) return null;
    return { center: [startLng, startLat], zoom: 13 };
  }, [view, startLng, startLat]);
  const settled = useDebouncedValue(target, SETTLE_MS);

  const onCameraMove = useCallback((move: CameraMove) => {
    if (move.settled) setView({ center: move.center, zoom: move.zoom });
  }, []);

  useEffect(() => {
    if (!enabled || !online || !settled || settled.zoom < MIN_ZOOM) return;
    let cancelled = false;
    exploreSegments(boundsFromCamera(settled.center, settled.zoom, width, height), nearbySegments)
      .then((segments) => {
        if (!cancelled) setFound(segments);
      })
      .catch((error) => logger.warn('[Map] Segments unavailable', error));
    return () => {
      cancelled = true;
    };
  }, [enabled, online, settled, width, height]);

  const pins = useMemo(() => {
    const byKey = new Map<string, SegmentPin>();
    const pin = (s: Segment | ReturnType<typeof starredList>[number], isStarred: boolean) =>
      byKey.set(s.key, {
        key: s.key,
        start: [s.start.longitude, s.start.latitude],
        end: [s.end.longitude, s.end.latitude],
        starred: isStarred,
      });
    if (enabled) for (const s of found) pin(s, Boolean(starred[s.key]));
    for (const s of starredList(starred)) pin(s, true);
    return [...byKey.values()];
  }, [enabled, found, starred]);

  return { pins, onCameraMove };
}
