/** Where an event starts. The chain stores it as 1e6 fixed-point integers, with 0/0 meaning "no place". */
export interface MeetingPoint {
  latitude: number;
  longitude: number;
}

const SCALE = 1e6;

export function meetingPointFromChain(lat: number, lng: number): MeetingPoint | undefined {
  if (lat === 0 && lng === 0) return undefined;
  return { latitude: lat / SCALE, longitude: lng / SCALE };
}

export function meetingPointToChain(point: MeetingPoint | undefined): {
  startLat: number;
  startLng: number;
} {
  if (!point) return { startLat: 0, startLng: 0 };
  return {
    startLat: Math.round(point.latitude * SCALE),
    startLng: Math.round(point.longitude * SCALE),
  };
}

/** A link that opens the phone's maps app with walking directions to the point. */
export function directionsUrl(point: MeetingPoint): string {
  const dest = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

/** "18.52040, 73.85670": short enough to read, precise to about a metre. */
export function formatMeetingPoint(point: MeetingPoint): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

/** A real place name, or null when the geocoder only echoed coordinates back (Android does this off-road). */
export function usefulPlaceName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(trimmed) ? null : trimmed;
}
