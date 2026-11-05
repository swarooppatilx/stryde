import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { MapCamera } from '@/components/map-camera';
import { getPlatform } from '@/platform';
import { createPlaceFinder, type PlaceResult, placeAt } from '@/services/placeSearch';
import { createLatestGate } from '@/utils/mapRoutes';

const DEBOUNCE_MS = 350;

/** The map's place search: debounced, newest query wins, focusing a hit moves the camera. */
export function usePlaceSearch(cameraRef: RefObject<MapCamera | null>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [focusedPlace, setFocusedPlace] = useState<PlaceResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gate = useRef(createLatestGate()).current;
  // Remembers recent searches for as long as the map screen is open.
  const find = useRef(createPlaceFinder(getPlatform().geocoder)).current;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const reset = useCallback(() => {
    gate.cancel();
    setSearchResults([]);
    setSearchError(null);
    setSearchedFor(null);
    setSearchLoading(false);
  }, [gate]);

  const searchPlaces = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (timer.current) clearTimeout(timer.current);

      const trimmed = query.trim();
      if (!trimmed) {
        reset();
        return;
      }

      timer.current = setTimeout(async () => {
        const request = gate.next();
        setSearchLoading(true);
        setSearchError(null);
        setSearchedFor(null);
        try {
          const results = await find(trimmed);
          if (!request.isCurrent()) return;
          setSearchResults(results);
          setSearchedFor(trimmed);
        } catch (err) {
          if (!request.isCurrent()) return;
          setSearchResults([]);
          setSearchError(err instanceof Error ? err.message : 'Unable to search for this place');
        } finally {
          if (request.isCurrent()) setSearchLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [gate, reset, find]
  );

  const focusPlace = useCallback(
    (result: PlaceResult) => {
      setFocusedPlace(result);
      setSearchResults([]);
      setSearchQuery(result.name);
      cameraRef.current?.easeTo({
        center: [result.longitude, result.latitude],
        zoom: 14,
        duration: 600,
      });
    },
    [cameraRef]
  );

  /** Hides the list and any status line but keeps what was typed and the pinned place. */
  const dismissResults = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    reset();
  }, [reset]);

  /** Pins a spot the athlete long-pressed; the camera stays where they are looking. */
  const dropPin = useCallback(
    async (latitude: number, longitude: number) => {
      if (timer.current) clearTimeout(timer.current);
      reset();
      const place = await placeAt(getPlatform().geocoder, latitude, longitude);
      setFocusedPlace(place);
      setSearchQuery(place.name);
    },
    [reset]
  );

  const clearSearch = useCallback(() => {
    reset();
    setSearchQuery('');
    setFocusedPlace(null);
  }, [reset]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    searchError,
    searchedFor,
    focusedPlace,
    searchPlaces,
    focusPlace,
    dismissResults,
    dropPin,
    clearSearch,
  };
}
