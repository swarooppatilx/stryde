import type { Camera, CameraStop } from '@rnmapbox/maps';
import type { ElementRef, RefObject } from 'react';
import type { Bounds } from '@/utils/routeBounds';

/** The native camera component's handle. */
export type CameraRef = ElementRef<typeof Camera>;

export interface CameraPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** A camera move; anything left out keeps its current value. No duration jumps straight there. */
export interface CameraMoveOptions {
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  padding?: CameraPadding;
  duration?: number;
}

/** The camera calls the app makes, independent of the map SDK underneath. */
export interface MapCamera {
  easeTo(options: CameraMoveOptions): void;
  zoomTo(zoom: number, options?: { duration?: number }): void;
  fitBounds(bounds: Bounds, options?: { padding?: CameraPadding; duration?: number }): void;
}

export function toMapboxPadding(padding: CameraPadding): NonNullable<CameraStop['padding']> {
  return {
    paddingTop: padding.top ?? 0,
    paddingRight: padding.right ?? 0,
    paddingBottom: padding.bottom ?? 0,
    paddingLeft: padding.left ?? 0,
  };
}

function animation(
  duration: number | undefined
): Pick<CameraStop, 'animationMode' | 'animationDuration'> {
  return duration
    ? { animationMode: 'easeTo', animationDuration: duration }
    : { animationMode: 'none', animationDuration: 0 };
}

export function toCameraStop({
  center,
  zoom,
  bearing,
  pitch,
  padding,
  duration,
}: CameraMoveOptions): CameraStop {
  return {
    ...(center && { centerCoordinate: center }),
    ...(zoom !== undefined && { zoomLevel: zoom }),
    ...(bearing !== undefined && { heading: bearing }),
    ...(pitch !== undefined && { pitch }),
    ...(padding && { padding: toMapboxPadding(padding) }),
    ...animation(duration),
  };
}

export function boundsStop(
  [west, south, east, north]: Bounds,
  options: { padding?: CameraPadding; duration?: number } = {}
): CameraStop {
  return {
    bounds: { ne: [east, north], sw: [west, south] },
    ...(options.padding && { padding: toMapboxPadding(options.padding) }),
    ...animation(options.duration),
  };
}

/** Wraps a Mapbox camera ref; calls before the native camera exists are dropped. */
export function createMapCamera(ref: RefObject<CameraRef | null>): MapCamera {
  return {
    easeTo: (options) => ref.current?.setCamera(toCameraStop(options)),
    zoomTo: (zoom, options) =>
      ref.current?.setCamera(toCameraStop({ zoom, duration: options?.duration })),
    fitBounds: (bounds, options) => ref.current?.setCamera(boundsStop(bounds, options)),
  };
}
