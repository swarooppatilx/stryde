import type { CameraRef } from '@maplibre/maplibre-react-native';
import { services } from '@repo/shared';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { SportFilter } from '@/components/filter-chips';
import { getCurrentUserId } from '@/constants/config';
import { Brand } from '@/constants/theme';
import { useActivityStore } from '@/stores/activityStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import type { Ring } from '@/types';
import { parsePolyline } from '@/utils/format';
import {
  heatmapPoints as buildHeatmap,
  SPORT_ROUTE_COLORS,
  territoryBoundsRing,
} from '@/utils/mapData';

function locationErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.includes('unsatisfied device settings')) {
    return 'Turn on device location (GPS) to see the map.';
  }
  return err instanceof Error ? err.message : 'Unable to get your location.';
}

export type FollowMode = 'default' | 'heading' | null;

export interface MapActivityRoute {
  id: string;
  coordinates: [number, number][];
  color: string;
  lineWidth?: number;
}

export type TimeFilter = 'all' | '7d' | '30d';

export interface MapSearchResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface SelectedTerritory {
  id: string;
  owner: string;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
}

/** Days in a UTC-second timestamp below which a route is filtered out. */
function isValidRoute(
  timestampMs: number,
  sportFilter: SportFilter,
  timeFilter: TimeFilter,
  sport?: string
): boolean {
  if (timeFilter === '7d' && timestampMs < Date.now() - 7 * 86400000) return false;
  if (timeFilter === '30d' && timestampMs < Date.now() - 30 * 86400000) return false;
  if (sportFilter === 'all' || sportFilter === 'multi') return true;
  return sport === sportFilter;
}

function routeColor(sport: string | undefined, own: boolean, themePrimary: string): string {
  if (own) return themePrimary;
  return (sport && SPORT_ROUTE_COLORS[sport as keyof typeof SPORT_ROUTE_COLORS]) ?? '#64748b';
}

export function useMap() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>('default');
  const [showRoutes, setShowRoutes] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [zoom, setZoom] = useState(15);
  const cameraRef = useRef<CameraRef>(null);

  const getUserPolygons = useTerritoryStore((s) => s.getUserPolygons);
  const getTerritoryMetadata = useTerritoryStore((s) => s.getTerritoryMetadata);
  const userId = getCurrentUserId();
  const userPolygons: Ring[] = useMemo(() => getUserPolygons(userId), [getUserPolygons, userId]);
  const territoryIds = useMemo(
    () => userPolygons.map((p) => services.territory.computePolygonHash(p)),
    [userPolygons]
  );
  const activities = useActivityStore((s) => s.activities);

  // --- cross-user data (others' routes + territory footprints), subgraph-gated
  const [othersRoutes, setOthersRoutes] = useState<
    Array<{ id: string; coordinates: [number, number][]; sport?: string; timestamp?: number }>
  >([]);
  const [othersTerritories, setOthersTerritories] = useState<{ id: string; ring: Ring }[]>([]);
  const [othersLoading, setOthersLoading] = useState(false);

  // --- search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [focusedPlace, setFocusedPlace] = useState<MapSearchResult | null>(null);

  // --- tapped territory inspect
  const [selectedTerritory, setSelectedTerritory] = useState<SelectedTerritory | null>(null);
  const [territoryLoading, setTerritoryLoading] = useState(false);

  const loadLocation = useCallback(async () => {
    setErrorMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // A cached fix is faster and works even when the device (or an
      // emulator's simulated GPS) can't get a fresh live fix in time.
      const cached = await Location.getLastKnownPositionAsync();
      if (cached) {
        setLocation({ latitude: cached.coords.latitude, longitude: cached.coords.longitude });
      }

      try {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ latitude: fresh.coords.latitude, longitude: fresh.coords.longitude });
      } catch (freshErr) {
        // A cached fix already rendered the map - a failed live-fix refresh
        // isn't worth surfacing as an error.
        if (!cached) throw freshErr;
      }
    } catch (err) {
      setErrorMsg(locationErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  // Granting permission or turning on GPS both send the app to the background
  // (Android's own system dialogs for these) and back. Retry silently on
  // return instead of leaving the user to tap "Try Again" as a third prompt
  // on top of the two system ones they just handled.
  const hasLocation = location !== null;
  useEffect(() => {
    if (hasLocation) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadLocation();
    });
    return () => subscription.remove();
  }, [hasLocation, loadLocation]);

  // Cross-user activity/territory data comes from the subgraph when one is
  // deployed (indexed; no fromBlock:0 rescan). Without a subgraph these layers
  // simply stay empty and the map keeps working with the user's own data.
  // The per-metadata IPFS fetches are bounded and best-effort.
  const loadOthers = useCallback(async () => {
    if (!showOthers) {
      setOthersRoutes([]);
      setOthersTerritories([]);
      return;
    }
    setOthersLoading(true);
    try {
      const [routesFromSubgraph, territoriesFromSubgraph] = await Promise.all([
        services.subgraph.getActivityRoutesFromSubgraph(150),
        services.subgraph.getTerritoriesFromSubgraph(900),
      ]);

      const routeStubs = routesFromSubgraph ?? [];
      const hydrated = await Promise.all(
        routeStubs.slice(0, 60).map(async (r) => {
          let coordinates: [number, number][] = [];
          if (r.metadataCid) {
            try {
              const meta = (await services.ipfs.fetchJsonFromIpfs(r.metadataCid)) as {
                coordinates?: Array<[number, number]>;
              } | null;
              coordinates = (meta?.coordinates ?? []).filter(
                (c) =>
                  Array.isArray(c) &&
                  c.length === 2 &&
                  Number.isFinite(c[0]) &&
                  Number.isFinite(c[1])
              );
            } catch {
              // best-effort — leave coordinates empty
            }
          }
          return {
            id: `other-${r.activityId.toString()}`,
            coordinates,
            sport: r.activityType,
            timestamp: r.timestamp,
          };
        })
      );

      setOthersRoutes(hydrated.filter((r) => r.coordinates.length >= 2));
      setOthersTerritories(
        (territoriesFromSubgraph ?? [])
          .filter((t) => t.bounds)
          .map((t) => ({ id: t.id, ring: territoryBoundsRing(t.bounds) }))
      );
    } catch (err) {
      console.warn('[Map] Failed to load others activity/territory data', err);
      setOthersRoutes([]);
      setOthersTerritories([]);
    } finally {
      setOthersLoading(false);
    }
  }, [showOthers]);

  useEffect(() => {
    loadOthers();
  }, [loadOthers]);

  // --- derived routes
  const ownRoutes = useMemo(() => {
    if (!showRoutes) return [];
    return activities
      .filter((a) => a.polyline)
      .filter((a) => isValidRoute(a.createdAt.getTime(), sportFilter, timeFilter, a.activityType))
      .map((a) => ({
        id: a.id,
        coordinates: parsePolyline(a.polyline),
      }))
      .filter((r) => r.coordinates.length >= 2);
  }, [activities, showRoutes, sportFilter, timeFilter]);

  const filteredOthersRoutes = useMemo(() => {
    if (!showRoutes || !showOthers) return [];
    return othersRoutes.filter((r) =>
      isValidRoute((r.timestamp ?? 0) * 1000, sportFilter, timeFilter, r.sport)
    );
  }, [othersRoutes, showRoutes, showOthers, sportFilter, timeFilter]);

  const activityRoutes = useMemo<MapActivityRoute[]>(() => {
    if (!showRoutes) return [];
    const own: MapActivityRoute[] = ownRoutes.map((r) => ({
      ...r,
      color: routeColor(undefined, true, Brand.primary),
    }));
    const others: MapActivityRoute[] = filteredOthersRoutes.map((r) => ({
      ...r,
      color: routeColor(r.sport, false, Brand.primary),
      lineWidth: 2,
    }));
    return [...own, ...others];
  }, [ownRoutes, filteredOthersRoutes, showRoutes]);

  const heatmapPoints = useMemo(() => {
    if (!showHeatmap) return [];
    const sourceRoutes: Array<{ coordinates: [number, number][] }> = [
      ...(showRoutes ? ownRoutes : []),
      ...(showOthers ? filteredOthersRoutes : []),
    ];
    return buildHeatmap(
      sourceRoutes.map((r, i) => ({ id: String(i), coordinates: r.coordinates, color: '#000' }))
    );
  }, [showHeatmap, showRoutes, showOthers, ownRoutes, filteredOthersRoutes]);

  const recenter = useCallback(() => {
    if (location) {
      cameraRef.current?.easeTo({
        center: [location.longitude, location.latitude],
        zoom: 15,
        duration: 300,
      });
    }
  }, [location]);

  const toggleFollow = useCallback(() => {
    setFollowMode((prev) => {
      if (prev === null) return 'default';
      if (prev === 'default') return 'heading';
      return null;
    });
  }, []);

  const toggleRoutes = useCallback(() => {
    setShowRoutes((prev) => !prev);
  }, []);

  const toggleHeatmap = useCallback(() => {
    setShowHeatmap((prev) => !prev);
  }, []);

  const toggleOthers = useCallback(() => {
    setShowOthers((prev) => !prev);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const next = Math.min(z + 1, 19);
      cameraRef.current?.zoomTo(next, { duration: 250 });
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(z - 1, 3);
      cameraRef.current?.zoomTo(next, { duration: 250 });
      return next;
    });
  }, []);

  const onMapZoomChanged = useCallback((zoom: number) => {
    if (typeof zoom === 'number' && Number.isFinite(zoom)) setZoom(zoom);
  }, []);

  // --- search
  const searchRef = useRef<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null });
  useEffect(() => {
    return () => {
      if (searchRef.current.timer) clearTimeout(searchRef.current.timer);
    };
  }, []);

  const searchPlaces = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchRef.current.timer) clearTimeout(searchRef.current.timer);

    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    searchRef.current.timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const geocoded = await Location.geocodeAsync(trimmed);
        const results: MapSearchResult[] = await Promise.all(
          geocoded.slice(0, 6).map(async (r, i) => {
            let name = '';
            try {
              const places = await Location.reverseGeocodeAsync({
                latitude: r.latitude,
                longitude: r.longitude,
              });
              const p = places[0];
              if (p) {
                name = [p.name, p.city, p.region, p.country].filter(Boolean).join(', ');
              }
            } catch {
              // keep whatever we have
            }
            return {
              id: `${r.latitude},${r.longitude}-${i}`,
              name: name || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
              latitude: r.latitude,
              longitude: r.longitude,
            };
          })
        );
        setSearchResults(results);
      } catch (err) {
        setSearchResults([]);
        setSearchError(err instanceof Error ? err.message : 'Unable to search for this place');
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, []);

  const focusPlace = useCallback((result: MapSearchResult) => {
    setFocusedPlace(result);
    setSearchResults([]);
    setSearchQuery(result.name);
    cameraRef.current?.easeTo({
      center: [result.longitude, result.latitude],
      zoom: 14,
      duration: 600,
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setFocusedPlace(null);
  }, []);

  // --- tapped territory → owner
  const handleTerritoryPress = useCallback(
    async (territoryId: string) => {
      setTerritoryLoading(true);
      try {
        // Local (own) territories have their metadata in the store already —
        // no contract read needed. Tapped others fall back to contract reads.
        const local = getTerritoryMetadata(territoryId);
        if (local) {
          setSelectedTerritory({
            id: territoryId,
            owner: local.owner,
            areaSqm: local.areaSqm,
            strength: local.strength,
            capturedAt: local.capturedAt,
            lastReinforced: local.lastReinforced,
          });
          return;
        }

        const [controller, territory] = await Promise.all([
          services.territory.getController(territoryId as `0x${string}`),
          services.territory.getTerritory(territoryId as `0x${string}`),
        ]);
        setSelectedTerritory({
          id: territoryId,
          owner: controller,
          areaSqm: Number(territory.areaSqm),
          strength: Number(territory.controlStrength),
          capturedAt: Number(territory.capturedAt),
          lastReinforced: Number(territory.lastReinforced),
        });
      } catch (err) {
        console.warn('[Map] Failed to load territory owner', err);
        setSelectedTerritory(null);
      } finally {
        setTerritoryLoading(false);
      }
    },
    [getTerritoryMetadata]
  );

  const closeTerritory = useCallback(() => setSelectedTerritory(null), []);

  return {
    location,
    errorMsg,
    followMode,
    showRoutes,
    showHeatmap,
    showOthers,
    othersLoading,
    sportFilter,
    timeFilter,
    setSportFilter,
    setTimeFilter,
    zoom,
    cameraRef,
    userPolygons,
    territoryIds,
    activityRoutes,
    othersTerritories,
    heatmapPoints,
    searchQuery,
    searchResults,
    searchLoading,
    searchError,
    focusedPlace,
    setSearchQuery,
    selectedTerritory,
    territoryLoading,
    loadLocation,
    recenter,
    toggleFollow,
    toggleRoutes,
    toggleHeatmap,
    toggleOthers,
    zoomIn,
    zoomOut,
    onMapZoomChanged,
    searchPlaces,
    focusPlace,
    clearSearch,
    handleTerritoryPress,
    closeTerritory,
  };
}
