import { type RefObject, useEffect, useRef } from 'react';
import type { MapCamera } from '@/components/map-camera';
import type { Ring } from '@/types';
import { logger } from '@/utils/logger';
import { fitPadding, routeBounds } from '@/utils/routeBounds';

const FIT_DELAY_MS = 350;
// The map-loaded callback has not always fired on a style whose glyphs 404, and a route left off
// screen behind the sheet looks like no route at all, so frame it anyway once this long has passed.
const READY_FALLBACK_MS = 1500;
const FIT_DURATION_MS = 800;

/**
 * Frames the route (and territory) in the part of the map a bottom sheet leaves visible.
 *
 * It frames again only when the route or territory changes, not when the sheet moves: a camera
 * that re-animates every time the sheet is toggled throws away wherever the athlete has panned to.
 */
export function useFitRoute(
  cameraRef: RefObject<MapCamera | null>,
  coordinates: [number, number][],
  territory: Ring | null | undefined,
  sheetHeight: number,
  /** Space to keep clear at the top, for controls floating over the map. */
  topInset?: number,
  /** False while the map is still loading; framing is then delayed rather than skipped. */
  ready = true
) {
  // Read at fit time so a sheet that settles after the effect was scheduled still counts.
  const sheetHeightRef = useRef(sheetHeight);
  sheetHeightRef.current = sheetHeight;

  useEffect(() => {
    const points = territory?.length ? [...coordinates, ...territory] : coordinates;
    const bounds = routeBounds(points);
    if (!bounds) return;

    // cameraRef attaches after the map mounts its Camera, which is after this effect first runs; check inside the timer.
    const timer = setTimeout(
      () => {
        try {
          cameraRef.current?.fitBounds(bounds, {
            padding: fitPadding({ sheetHeight: sheetHeightRef.current, topInset }),
            duration: FIT_DURATION_MS,
          });
        } catch (error) {
          // The native camera throws until the map exists; an unframed map beats a crash.
          logger.warn('Could not frame the route', error);
        }
      },
      ready ? FIT_DELAY_MS : READY_FALLBACK_MS
    );

    return () => clearTimeout(timer);
  }, [cameraRef, coordinates, territory, topInset, ready]);
}
