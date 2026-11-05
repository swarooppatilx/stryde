/** TerritoryRegistry and EventRegistry store coordinates as degrees × 1e6 in an int32. */
const SCALE = 1e6;

export function toFixedPoint(degrees: number): number {
  return Math.round(degrees * SCALE);
}

export function fromFixedPoint(fixed: number): number {
  return fixed / SCALE;
}
