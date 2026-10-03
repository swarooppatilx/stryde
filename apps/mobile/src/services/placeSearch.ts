import type { Geocoder } from '@/platform/ports';

export interface PlaceResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const MAX_RESULTS = 6;

const coordinateName = (latitude: number, longitude: number) =>
  `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

/** A place at a spot on the map (a dropped pin), named when the geocoder knows it. */
export async function placeAt(
  geocoder: Geocoder,
  latitude: number,
  longitude: number
): Promise<PlaceResult> {
  const name = await geocoder.placeName(latitude, longitude).catch(() => null);
  return {
    id: `${latitude},${longitude}`,
    name: name || coordinateName(latitude, longitude),
    latitude,
    longitude,
  };
}

/** Geocodes `query` and names each hit; a hit whose name can't be looked up keeps its coordinates. */
export async function findPlaces(geocoder: Geocoder, query: string): Promise<PlaceResult[]> {
  const hits = (await geocoder.geocode(query)).slice(0, MAX_RESULTS);
  return Promise.all(
    hits.map(async ({ latitude, longitude }, i) => {
      const name = await geocoder.placeName(latitude, longitude).catch(() => null);
      return {
        id: `${latitude},${longitude}-${i}`,
        name: name || coordinateName(latitude, longitude),
        latitude,
        longitude,
      };
    })
  );
}

/**
 * `findPlaces` that remembers the last few answers, so typing the same place again (or backing
 * up a letter) does not call the geocoder, and its seven lookups per search, a second time.
 */
export function createPlaceFinder(geocoder: Geocoder, capacity = 20) {
  const answers = new Map<string, PlaceResult[]>();
  return async (query: string): Promise<PlaceResult[]> => {
    const key = query.trim().toLowerCase();
    const known = answers.get(key);
    if (known) return known;
    const found = await findPlaces(geocoder, key);
    answers.set(key, found);
    if (answers.size > capacity) {
      const oldest = answers.keys().next().value;
      if (oldest !== undefined) answers.delete(oldest);
    }
    return found;
  };
}
