import type { CameraRef } from '@maplibre/maplibre-react-native';
import { services } from '@repo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { SportFilter } from '@/components/filter-chips';
import { Palette } from '@/constants/palette';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { getPlatform } from '@/platform';
import { ensureForegroundLocation } from '@/services/locationPermission';
import { useActivityStore } from '@/stores/activityStore';
import { hasActiveFilters, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { userPolygons as selectUserPolygons, useTerritoryStore } from '@/stores/territoryStore';
import type { Ring } from '@/types';
import { type DistanceFilter, inDistanceBand, routeLength } from '@/utils/distanceFilter';
import { isLocationServicesOff } from '@/utils/errors';
import { parsePolyline } from '@/utils/format';
import { logger } from '@/utils/logger';
import { heatmapPoints as buildHeatmap, territoryBoundsRing } from '@/utils/mapData';
import { routeColorFor, visibleRoutes } from '@/utils/mapRoutes';
import { matchesSportFilter } from '@/utils/sportFilter';
import { usePlaceSearch } from './usePlaceSearch';

function locationErrorMessage(err: unknown): string {
  if (isLocationServicesOff(err)) {
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

const TILT_DEGREES = 60;

export type TimeFilter = 'all' | '7d' | '30d';

export type { PlaceResult as MapSearchResult } from '@/services/placeSearch';
export type { DistanceFilter };

export interface SelectedTerritory {
  id: string;
  owner: string;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
}

function isValidRoute(
  timestampMs: number,
  sportFilter: SportFilter,
  timeFilter: TimeFilter,
  sport?: string
): boolean {
  if (timeFilter === '7d' && timestampMs < Date.now() - 7 * 86400000) return false;
  if (timeFilter === '30d' && timestampMs < Date.now() - 30 * 86400000) return false;
  return matchesSportFilter(sportFilter, sport);
}

export function useMap() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>('default');
  const showRoutes = useMapPrefsStore((s) => s.showRoutes);
  const showHeatmap = useMapPrefsStore((s) => s.showHeatmap);
  const showOthers = useMapPrefsStore((s) => s.showOthers);
  const sportFilter = useMapPrefsStore((s) => s.sport);
  const timeFilter = useMapPrefsStore((s) => s.time);
  const distanceFilter = useMapPrefsStore((s) => s.distance);
  const setLayer = useMapPrefsStore((s) => s.setLayer);
  const setSportFilter = useMapPrefsStore((s) => s.setSport);
  const setTimeFilter = useMapPrefsStore((s) => s.setTime);
  const setDistanceFilter = useMapPrefsStore((s) => s.setDistance);
  const clearFilters = useMapPrefsStore((s) => s.clearFilters);
  const filtersActive = hasActiveFilters({
    sport: sportFilter,
    time: timeFilter,
    distance: distanceFilter,
  });
  const [zoom, setZoom] = useState(15);
  const cameraRef = useRef<CameraRef>(null);

  const getTerritoryMetadata = useTerritoryStore((s) => s.getTerritoryMetadata);
  const userId = useCurrentUserId();
  const userPolygons: Ring[] = useTerritoryStore((s) => selectUserPolygons(s, userId));
  const territoryIds = useMemo(
    () => userPolygons.map((p) => services.territory.computePolygonHash(p)),
    [userPolygons]
  );
  const activities = useActivityStore((s) => s.activities);

  const [othersRoutes, setOthersRoutes] = useState<
    Array<{ id: string; coordinates: [number, number][]; sport?: string; timestamp?: number }>
  >([]);
  const [othersTerritories, setOthersTerritories] = useState<{ id: string; ring: Ring }[]>([]);
  const [othersLoading, setOthersLoading] = useState(false);

  const [selectedTerritory, setSelectedTerritory] = useState<SelectedTerritory | null>(null);
  const [territoryLoading, setTerritoryLoading] = useState(false);

  // Set after the user declines the GPS prompt so returning from that dialog does not ask again.
  const gpsRefusedRef = useRef(false);

  const loadLocation = useCallback(async () => {
    setErrorMsg(null);
    gpsRefusedRef.current = false;
    try {
      if (!(await ensureForegroundLocation())) {
        setErrorMsg('Location is needed to show the map around you');
        return;
      }

      // A cached fix is faster and works when the device cannot get a live fix in time.
      const { location: source } = getPlatform();
      const cached = await source.getLastKnown();
      if (cached) {
        setLocation({ latitude: cached.latitude, longitude: cached.longitude });
      }

      try {
        const fresh = await source.getCurrent('balanced');
        setLocation({ latitude: fresh.latitude, longitude: fresh.longitude });
      } catch (freshErr) {
        // A cached fix already rendered the map; a failed live refresh is not worth an error.
        if (!cached) throw freshErr;
      }
    } catch (err) {
      gpsRefusedRef.current = isLocationServicesOff(err);
      setErrorMsg(locationErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadLocation();
  }, [loadLocation]);

  // The map opens at the default view straight away; the first fix brings the camera to the athlete.
  const centeredOnFix = useRef(false);
  useEffect(() => {
    if (!location || centeredOnFix.current) return;
    centeredOnFix.current = true;
    cameraRef.current?.easeTo({
      center: [location.longitude, location.latitude],
      zoom: 15,
      duration: 600,
    });
  }, [location]);

  // Granting permission or enabling GPS backgrounds the app via Android system dialogs; retry silently on return instead of adding a third prompt.
  const hasLocation = location !== null;
  useEffect(() => {
    if (hasLocation) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !gpsRefusedRef.current) void loadLocation();
    });
    return () => subscription.remove();
  }, [hasLocation, loadLocation]);

  // Cross-user data comes from the subgraph when deployed (no fromBlock:0 rescan); without one the layers stay empty. Per-metadata IPFS fetches are bounded and best-effort.
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
      logger.warn('[Map] Failed to load others activity/territory data', err);
      setOthersRoutes([]);
      setOthersTerritories([]);
    } finally {
      setOthersLoading(false);
    }
  }, [showOthers]);

  useEffect(() => {
    void loadOthers();
  }, [loadOthers]);

  const ownRoutes = useMemo(() => {
    if (!showRoutes) return [];
    return activities
      .filter((a) => a.polyline)
      .filter((a) => isValidRoute(a.createdAt.getTime(), sportFilter, timeFilter, a.activityType))
      .filter((a) => inDistanceBand(distanceFilter, a.distance))
      .map((a) => ({
        id: a.id,
        coordinates: parsePolyline(a.polyline),
        sport: a.activityType as string | undefined,
      }))
      .filter((r) => r.coordinates.length >= 2);
  }, [activities, showRoutes, sportFilter, timeFilter, distanceFilter]);

  const filteredOthersRoutes = useMemo(() => {
    if (!showOthers) return [];
    return othersRoutes.filter(
      (r) =>
        isValidRoute((r.timestamp ?? 0) * 1000, sportFilter, timeFilter, r.sport) &&
        inDistanceBand(distanceFilter, routeLength(r.coordinates))
    );
  }, [othersRoutes, showOthers, sportFilter, timeFilter, distanceFilter]);

  const activityRoutes = useMemo<MapActivityRoute[]>(() => {
    const own: MapActivityRoute[] = ownRoutes.map((r) => ({
      id: r.id,
      coordinates: r.coordinates,
      color: routeColorFor(r.sport),
    }));
    const others: MapActivityRoute[] = filteredOthersRoutes.map((r) => ({
      id: r.id,
      coordinates: r.coordinates,
      color: routeColorFor(r.sport),
      lineWidth: 2,
    }));
    return visibleRoutes({ showRoutes, showOthers, own, others });
  }, [ownRoutes, filteredOthersRoutes, showRoutes, showOthers]);

  const heatmapPoints = useMemo(() => {
    if (!showHeatmap) return [];
    const sourceRoutes = visibleRoutes<{ coordinates: [number, number][] }>({
      showRoutes,
      showOthers,
      own: ownRoutes,
      others: filteredOthersRoutes,
    });
    return buildHeatmap(
      sourceRoutes.map((r, i) => ({
        id: String(i),
        coordinates: r.coordinates,
        color: Palette.black,
      }))
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

  const [tilted, setTilted] = useState(false);
  const toggleTilt = useCallback(() => {
    const next = !tilted;
    setTilted(next);
    // Only the tilt changes: the current zoom is passed back so the view does not jump out.
    void cameraRef.current?.setStop({
      pitch: next ? TILT_DEGREES : 0,
      zoom,
      duration: 500,
    });
  }, [tilted, zoom]);

  const toggleFollow = useCallback(() => {
    setFollowMode((prev) => {
      if (prev === null) return 'default';
      if (prev === 'default') return 'heading';
      return null;
    });
  }, []);

  const toggleRoutes = useCallback(
    () => setLayer('routes', !useMapPrefsStore.getState().showRoutes),
    [setLayer]
  );
  const toggleHeatmap = useCallback(
    () => setLayer('heatmap', !useMapPrefsStore.getState().showHeatmap),
    [setLayer]
  );
  const toggleOthers = useCallback(
    () => setLayer('others', !useMapPrefsStore.getState().showOthers),
    [setLayer]
  );

  // The camera is told to move outside the state update (an updater must stay pure).
  const zoomRef = useRef(15);
  const applyZoom = useCallback((next: number) => {
    zoomRef.current = next;
    setZoom(next);
    cameraRef.current?.zoomTo(next, { duration: 250 });
  }, []);
  const zoomIn = useCallback(() => applyZoom(Math.min(zoomRef.current + 1, 19)), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(Math.max(zoomRef.current - 1, 3)), [applyZoom]);

  const onMapZoomChanged = useCallback((next: number) => {
    if (typeof next === 'number' && Number.isFinite(next)) {
      zoomRef.current = next;
      setZoom(next);
    }
  }, []);

  const search = usePlaceSearch(cameraRef);

  const handleTerritoryPress = useCallback(
    async (territoryId: string) => {
      setTerritoryLoading(true);
      try {
        // Own territories have metadata in the store; others fall back to contract reads.
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
        logger.warn('[Map] Failed to load territory owner', err);
        setSelectedTerritory(null);
      } finally {
        setTerritoryLoading(false);
      }
    },
    [getTerritoryMetadata]
  );

  /** The native map reports when the athlete drags away: stop following so it does not snap back. */
  const onFollowChange = useCallback((following: boolean) => {
    if (!following) setFollowMode(null);
  }, []);

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
    distanceFilter,
    clearFilters,
    filtersActive,
    setDistanceFilter,
    setSportFilter,
    setTimeFilter,
    zoom,
    cameraRef,
    userPolygons,
    territoryIds,
    activityRoutes,
    othersTerritories,
    heatmapPoints,
    selectedTerritory,
    territoryLoading,
    loadLocation,
    recenter,
    toggleFollow,
    tilted,
    toggleTilt,
    onFollowChange,
    toggleRoutes,
    toggleHeatmap,
    toggleOthers,
    zoomIn,
    zoomOut,
    onMapZoomChanged,
    handleTerritoryPress,
    closeTerritory,
    ...search,
  };
}
