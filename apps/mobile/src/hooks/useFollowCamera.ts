import type { CameraRef } from '@maplibre/maplibre-react-native';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { CameraMove } from '@/components/map-route';
import type { Location } from '@/types';
import {
  buildTarget,
  type CameraTarget,
  classifyViewChange,
  EASE_MS,
  shouldEase,
  smoothHeading,
  stepZoom,
  type ViewSnapshot,
  ZOOM_EASE_MS,
} from '@/utils/followCamera';
import { type FollowState, RECORDING_ZOOM } from '@/utils/recordCamera';

/** The heading to show for the latest fix: the GPS course while moving, smoothed, else the last one. */
export function useSmoothedHeading(fix: Location | null): number | null {
  const [state, setState] = useState<{ fix: Location | null; heading: number | null }>({
    fix: null,
    heading: null,
  });
  if (fix !== state.fix) {
    setState({ fix, heading: fix ? smoothHeading(state.heading, fix) : null });
  }
  return state.heading;
}

interface Options {
  cameraRef: RefObject<CameraRef | null>;
  fix: Location | null;
  heading: number | null;
  follow: FollowState;
  /** A recording is under way; the first fix of one steps in to street level. */
  active: boolean;
  mapHeight: number;
  initialZoom: number;
  /** Height of the controls over the bottom of the map, kept clear of the puck. */
  bottomInset?: number;
  /** 3D view. */
  tilted?: boolean;
  /** The athlete dragged or rotated the map away. */
  onUserMoved: () => void;
}

/**
 * Drives the Record map's camera: while following, it eases to the puck on fixes that moved it
 * enough to matter, at the zoom the athlete last chose. Dragging or rotating hands the map back;
 * pinching only changes the zoom that following keeps.
 */
export function useFollowCamera({
  cameraRef,
  fix,
  heading,
  follow,
  active,
  mapHeight,
  initialZoom,
  bottomInset = 0,
  tilted = false,
  onUserMoved,
}: Options) {
  const zoomRef = useRef(initialZoom);
  const viewRef = useRef<ViewSnapshot | null>(null);
  const targetRef = useRef<CameraTarget | null>(null);
  const seenRef = useRef({ following: follow.following, mode: follow.mode, active });
  const followingRef = useRef(follow.following);

  const { following, mode } = follow;
  useEffect(() => {
    followingRef.current = following;
  }, [following]);
  useEffect(() => {
    const seen = seenRef.current;
    const changed = seen.following !== following || seen.mode !== mode;
    if (active && !seen.active) zoomRef.current = Math.max(zoomRef.current, RECORDING_ZOOM);
    const forced = changed || active !== seen.active;
    seenRef.current = { following, mode, active };
    if (!following || !fix) return;

    const next = buildTarget({
      position: [fix.longitude, fix.latitude],
      mode,
      zoom: zoomRef.current,
      heading,
      currentBearing: viewRef.current?.bearing ?? 0,
      mapHeight,
      bottomInset,
      tilted,
    });
    if (!forced && !shouldEase(targetRef.current, next)) return;
    targetRef.current = next;
    cameraRef.current?.easeTo({ ...next, duration: EASE_MS });
  }, [fix, heading, following, mode, active, mapHeight, bottomInset, tilted, cameraRef]);

  const onCameraMove = useCallback(
    (move: CameraMove) => {
      const view: ViewSnapshot = { center: move.center, zoom: move.zoom, bearing: move.bearing };
      const before = viewRef.current;
      if (!move.userInteraction || !before) {
        // The first event only gives a baseline to measure a gesture against.
        if (!before || move.settled) viewRef.current = view;
        if (move.settled) zoomRef.current = move.zoom;
        return;
      }
      const change = classifyViewChange(before, view);
      if (move.settled) {
        viewRef.current = view;
        zoomRef.current = move.zoom;
      }
      if ((change === 'pan' || change === 'rotate') && followingRef.current) onUserMoved();
    },
    [onUserMoved]
  );

  const zoomBy = useCallback(
    (direction: 1 | -1) => {
      const zoom = stepZoom(zoomRef.current, direction);
      zoomRef.current = zoom;
      const position = fix && followingRef.current ? [fix.longitude, fix.latitude] : null;
      if (!position) {
        cameraRef.current?.zoomTo(zoom, { duration: ZOOM_EASE_MS });
        return;
      }
      const next = buildTarget({
        position: position as [number, number],
        mode,
        zoom,
        heading,
        currentBearing: viewRef.current?.bearing ?? 0,
        mapHeight,
        bottomInset,
        tilted,
      });
      targetRef.current = next;
      cameraRef.current?.easeTo({ ...next, duration: ZOOM_EASE_MS });
    },
    [cameraRef, fix, heading, mode, mapHeight, bottomInset, tilted]
  );

  return { onCameraMove, zoomBy };
}
