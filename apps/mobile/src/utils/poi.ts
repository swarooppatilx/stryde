import type { Ionicons } from '@expo/vector-icons';
import type { SportFilter } from '@/components/filter-chips';
import { haversineDistance } from '@/utils/geo';

/** A place label tapped on the base map (Mapbox Streets `poi_label`). */
export interface MapPoi {
  name: string;
  /** Human words for what it is, e.g. "Cafe" or "Drinking water". */
  kind: string;
  /** Mapbox's icon key (maki), used to pick our own icon. */
  maki: string;
  coordinate: [number, number];
}

type IconName = keyof typeof Ionicons.glyphMap;

/** Places athletes look for mid-run or mid-ride get a specific icon; the rest a generic pin. */
const ICON_OF_MAKI: Record<string, IconName> = {
  cafe: 'cafe-outline',
  restaurant: 'restaurant-outline',
  'fast-food': 'fast-food-outline',
  bakery: 'cafe-outline',
  bar: 'beer-outline',
  toilet: 'man-outline',
  'drinking-water': 'water-outline',
  viewpoint: 'eye-outline',
  park: 'leaf-outline',
  garden: 'leaf-outline',
  bicycle: 'bicycle-outline',
  'bicycle-share': 'bicycle-outline',
  parking: 'car-outline',
  'parking-garage': 'car-outline',
  hospital: 'medkit-outline',
  pharmacy: 'medkit-outline',
  grocery: 'cart-outline',
  shop: 'storefront-outline',
  fuel: 'speedometer-outline',
  mountain: 'triangle-outline',
  'picnic-site': 'leaf-outline',
  campsite: 'bonfire-outline',
  water: 'water-outline',
  swimming: 'water-outline',
};

export function poiIcon(maki: string): IconName {
  return ICON_OF_MAKI[maki] ?? 'location-outline';
}

const titleCase = (text: string) =>
  text
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Reads a tapped feature of the base map's place labels; null when it has no name or position. */
export function poiFromFeature(feature: {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}): MapPoi | null {
  const props = feature.properties ?? {};
  const name = typeof props.name === 'string' ? props.name.trim() : '';
  const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  if (!name || !Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords as [unknown, unknown];
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  const maki = typeof props.maki === 'string' ? props.maki : '';
  const rawKind =
    (typeof props.type === 'string' && props.type) ||
    (typeof props.category_en === 'string' && props.category_en) ||
    (typeof props.class === 'string' && props.class) ||
    maki ||
    'Place';
  return { name, kind: titleCase(rawKind), maki, coordinate: [lng, lat] };
}

/** Typical moving speed by sport (m/s), for a rough arrival time. */
const TYPICAL_SPEED_MS: Record<SportFilter, number> = {
  all: 1.4,
  run: 2.8,
  ride: 5.6,
  hike: 1.2,
  swim: 1.4,
  multi: 1.4,
};

/** Straight-line distance from the athlete to the place. */
export function distanceTo(from: { latitude: number; longitude: number }, poi: MapPoi): number {
  return haversineDistance(from.latitude, from.longitude, poi.coordinate[1], poi.coordinate[0]);
}

/**
 * Time to get there at a typical pace for the sport. Paths wind, so the straight line is
 * stretched by a fifth before dividing.
 */
export function etaMs(distanceM: number, sport: SportFilter): number {
  return ((distanceM * 1.2) / TYPICAL_SPEED_MS[sport]) * 1000;
}
