export type Bounds = [west: number, south: number, east: number, north: number];

export const FIT_SIDE_PADDING = 50;
export const FIT_TOP_EXTRA = 40;

/** The box around a route, or null when there is no line to frame. A loop, not Math.min(...xs): a long recording has more points than a call can take as arguments. */
export function routeBounds(points: readonly (readonly [number, number])[]): Bounds | null {
  if (points.length < 2) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

/** Space the camera keeps clear: the sheet at the bottom, floating controls at the top. */
export function fitPadding({
  sheetHeight,
  topInset = FIT_SIDE_PADDING + FIT_TOP_EXTRA,
}: {
  sheetHeight: number;
  topInset?: number;
}) {
  return {
    top: topInset,
    right: FIT_SIDE_PADDING,
    // The sheet reports a height only once it has been measured.
    bottom: Math.max(sheetHeight, 0) + FIT_SIDE_PADDING,
    left: FIT_SIDE_PADDING,
  };
}
