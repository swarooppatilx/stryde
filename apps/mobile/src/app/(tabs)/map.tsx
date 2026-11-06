import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import type { SportFilter } from '@/components/filter-chips';
import { MapBottomSheet } from '@/components/map-bottom-sheet';
import { type MapChip, MapChips } from '@/components/map-chips';
import { MapLayersSheet } from '@/components/map-layers-sheet';
import { MapLegend } from '@/components/map-legend';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { MapSearchBar } from '@/components/map-search-bar';
import { PoiCard } from '@/components/poi-card';
import { Tappable } from '@/components/tappable';
import { TerritorySheet } from '@/components/territory-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_CENTER } from '@/constants/config';
import { heatRampFor } from '@/constants/heatmapColors';
import { MAP_CHROME_BOTTOM, MapChrome } from '@/constants/mapChrome';
import { BorderRadius, Brand, OTHERS_TERRITORY_COLOR, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useDownloadedRouteIds } from '@/hooks/useDownloadedRouteIds';
import { useFitRoute } from '@/hooks/useFitRoute';
import { useHideTabBar } from '@/hooks/useHideTabBar';
import { type DistanceFilter, type TimeFilter, useMap } from '@/hooks/useMap';
import { useOnline } from '@/hooks/useOnline';
import { useRoutePreview } from '@/hooks/useRoutePreview';
import type { PlaceResult } from '@/services/placeSearch';
import { layerBadgeCount, resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { MEDIUM_MAX, SHORT_MAX } from '@/utils/distanceFilter';
import { formatDistance, parsePolyline } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import type { MapPoi } from '@/utils/poi';
import { routeChips } from '@/utils/routeChips';
import { SHEET_HEIGHTS } from '@/utils/sheetSnap';

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'all', label: 'Anytime' },
  { value: '7d', label: 'Past week' },
  { value: '30d', label: 'Past month' },
];

/** The route builder's sport for the map's sport filter. */
const BUILDER_SPORT: Record<SportFilter, 'run' | 'ride' | 'walk' | 'hike'> = {
  all: 'walk',
  run: 'run',
  ride: 'ride',
  hike: 'hike',
  swim: 'walk',
  multi: 'walk',
};

const LOCATE_ICON = {
  off: 'locate-outline',
  default: 'locate',
  heading: 'navigate',
  course: 'navigate',
} as const;
const LOCATE_LABEL = {
  off: 'Recenter map on my location',
  default: 'Following my location. Tap to face my heading',
  heading: 'Facing my heading. Tap to stop following',
  course: 'Facing my heading. Tap to stop following',
} as const;

function placeAndRouteMarkers(
  focusedPlace: Pick<PlaceResult, 'latitude' | 'longitude'> | null,
  previewLine: [number, number][],
  brand: Pick<typeof Brand, 'primary' | 'success' | 'danger'>
): MapMarker[] {
  const list: MapMarker[] = [];
  if (focusedPlace) {
    list.push({
      id: 'place',
      coordinate: [focusedPlace.longitude, focusedPlace.latitude],
      color: brand.primary,
      icon: 'location',
    });
  }
  // A previewed route shows where it starts and where it ends.
  const start = previewLine[0];
  const finish = previewLine[previewLine.length - 1];
  if (start && finish && previewLine.length > 1) {
    list.push({ id: 'route-start', coordinate: start, color: brand.success, icon: 'play' });
    list.push({
      id: 'route-finish',
      coordinate: finish,
      color: brand.danger,
      icon: 'flag',
    });
  }
  return list;
}

export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const stylePref = useMapPrefsStore((s) => s.style);
  const showPoi = useMapPrefsStore((s) => s.showPoi);
  const mapType = useMapPrefsStore((s) => s.mapType);
  const terrain3d = useMapPrefsStore((s) => s.terrain3d);
  const showBikeLanes = useMapPrefsStore((s) => s.showBikeLanes);
  const layersBadge = useMapPrefsStore((s) => layerBadgeCount(s));
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  // Map-only: every control, the sheet and the tab bar step aside for an uncluttered map.
  const [mapOnly, setMapOnly] = useState(false);
  const [poi, setPoi] = useState<MapPoi | null>(null);
  const downloadedRoutes = useDownloadedRouteIds();
  useHideTabBar(mapOnly);
  const router = useRouter();
  const { preview, setPreview, hide: hidePreview } = useRoutePreview();
  const previewLine = preview ? parsePolyline(preview.polyline) : [];
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);
  const [distanceMenuOpen, setDistanceMenuOpen] = useState(false);
  const unitSystem = useUnitSystem();
  const sheetHeight = useSharedValue<number>(SHEET_HEIGHTS.peek);
  const locateSlotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -sheetHeight.value }],
  }));

  const {
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
    setDistanceFilter,
    clearFilters,
    filtersActive,
    setSportFilter,
    setTimeFilter,
    cameraRef,
    userPolygons,
    territoryIds,
    activityRoutes,
    othersTerritories,
    heatmapPoints,
    heatmapColor,
    searchQuery,
    searchResults,
    searchLoading,
    searchError,
    searchedFor,
    focusedPlace,
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
    onMapZoomChanged,
    searchPlaces,
    focusPlace,
    dismissResults,
    dropPin,
    clearSearch,
    handleTerritoryPress,
    closeTerritory,
  } = useMap();
  // 3D terrain is only worth seeing from an angle: switching it on leans the map over.
  const [leanedFor3d, setLeanedFor3d] = useState(false);
  if (terrain3d && !tilted && !leanedFor3d) {
    setLeanedFor3d(true);
    toggleTilt();
  } else if (!terrain3d && leanedFor3d) {
    setLeanedFor3d(false);
  }
  // The search bar, chips and any banner cover the top of the map; keep the route clear of them.
  useFitRoute(
    cameraRef,
    previewLine,
    null,
    SHEET_HEIGHTS.peek,
    insets.top + MAP_CHROME_BOTTOM + 120
  );
  // Picking a place hands the map its view, so the keyboard and the list get out of the way.
  const openPlace = (result: (typeof searchResults)[number]) => {
    Keyboard.dismiss();
    focusPlace(result);
  };
  const distanceOptions: Array<{ value: DistanceFilter; label: string }> = [
    { value: 'any', label: 'Any distance' },
    { value: 'short', label: `Under ${formatDistance(SHORT_MAX, unitSystem)}` },
    {
      value: 'medium',
      label: `${formatDistance(SHORT_MAX, unitSystem)} to ${formatDistance(MEDIUM_MAX, unitSystem)}`,
    },
    { value: 'long', label: `Over ${formatDistance(MEDIUM_MAX, unitSystem)}` },
  ];
  const distanceActions: SheetAction[] = distanceOptions.map((o) => ({
    label: o.label,
    icon: o.value === distanceFilter ? 'checkmark-circle' : 'ellipse-outline',
    onPress: () => setDistanceFilter(o.value),
  }));
  // The searched or long-pressed place, drawn inside the map.
  const placeMarkers: MapMarker[] = placeAndRouteMarkers(focusedPlace, previewLine, theme.brand);
  const chips: MapChip[] = [
    // First, so the way out of a route preview is always in view.
    ...routeChips(preview !== null, {
      hide: hidePreview,
      openDetails: () => preview && router.push(`/routes/${preview.id}`),
      plan: () => router.push('/route-builder'),
    }),
    { key: 'routes', label: 'Routes', active: showRoutes, onPress: toggleRoutes },
    { key: 'heatmap', label: 'Heatmap', active: showHeatmap, onPress: toggleHeatmap },
    { key: 'others', label: 'Others', active: showOthers, onPress: toggleOthers },
    // A filter, not a layer: it shows its current value and opens a list to change it.
    {
      key: 'time',
      label: TIME_FILTERS.find((f) => f.value === timeFilter)?.label ?? 'Anytime',
      active: timeFilter !== 'all',
      menu: true,
      onPress: () => setTimeMenuOpen(true),
    },
    {
      key: 'distance',
      label: distanceOptions.find((o) => o.value === distanceFilter)?.label ?? 'Any distance',
      active: distanceFilter !== 'any',
      menu: true,
      onPress: () => setDistanceMenuOpen(true),
    },
    ...(filtersActive
      ? [{ key: 'reset', label: 'Reset filters', active: false, onPress: clearFilters }]
      : []),
  ];
  const timeActions: SheetAction[] = TIME_FILTERS.map((f) => ({
    label: f.label,
    icon: f.value === timeFilter ? 'checkmark-circle' : 'ellipse-outline',
    onPress: () => setTimeFilter(f.value),
  }));
  // The native compass starts below the chip row so it is never hidden behind it.
  /** The route builder, started from a tapped place in one of three ways. */
  const openBuilder = (opts: {
    to?: [number, number];
    from?: [number, number];
    loop?: boolean;
  }) => {
    setPoi(null);
    router.push({
      pathname: '/route-builder',
      params: {
        ...(opts.to && { to: opts.to.join(',') }),
        ...(opts.from && { from: opts.from.join(',') }),
        ...(opts.loop && { loop: '1' }),
        sport: BUILDER_SPORT[sportFilter],
      },
    });
  };
  const statusSurface = { backgroundColor: theme.backgroundElement };
  const heatRamp = heatRampFor(heatmapColor);
  const compassTopOffset = mapOnly
    ? insets.top + MapChrome.edge + MapChrome.fab + Spacing.two
    : insets.top + MAP_CHROME_BOTTOM + Spacing.two;

  return (
    <ThemedView type="background" style={styles.container}>
      <MapRoute
        cameraRef={cameraRef}
        territoryPolygons={userPolygons}
        territoryIds={territoryIds}
        territoryColor={theme.brand.primary}
        territoryOpacity={0.22}
        othersTerritories={othersTerritories}
        othersTerritoryColor={OTHERS_TERRITORY_COLOR}
        othersTerritoryOpacity={0.14}
        // The native location layer starts only once there is a fix; before that it just logs errors.
        showUserLocation={location !== null}
        coordinates={previewLine.length > 1 ? previewLine : undefined}
        followUser={location ? (followMode ?? undefined) : undefined}
        onFollowChange={onFollowChange}
        onMapPress={() => {
          Keyboard.dismiss();
          dismissResults();
          setPoi(null);
        }}
        onPoiPress={(place) => {
          Keyboard.dismiss();
          dismissResults();
          haptics.selection();
          setPoi(place);
        }}
        onMapLongPress={([lng, lat]) => {
          haptics.impactMedium();
          void dropPin(lat, lng);
        }}
        initialCenter={location ? [location.longitude, location.latitude] : DEFAULT_CENTER}
        initialZoom={15}
        dark={resolveMapStyle(stylePref, theme.isDark) === 'dark'}
        mapType={mapType}
        terrain3d={terrain3d}
        poi={showPoi}
        bikeLanes={showBikeLanes}
        activityRoutes={activityRoutes}
        markers={placeMarkers}
        compassTopOffset={compassTopOffset}
        heatmapPoints={heatmapPoints}
        heatmapVisible={showHeatmap}
        heatmapColor={heatmapColor}
        onTerritoryPress={handleTerritoryPress}
        onZoomChanged={onMapZoomChanged}
      />

      {mapOnly && (
        <Tappable
          style={[
            styles.locate,
            styles.mapOnlyExit,
            theme.shadows.raised,
            { top: insets.top + MapChrome.edge, backgroundColor: theme.backgroundElement },
          ]}
          onPress={() => setMapOnly(false)}
          accessibilityRole="button"
          accessibilityLabel="Show the map controls again"
        >
          <Ionicons name="contract-outline" size={22} color={theme.text} />
        </Tappable>
      )}

      {!mapOnly && (
        <View style={[styles.topToolbar, { top: insets.top + MapChrome.edge }]}>
          <MapSearchBar
            query={searchQuery}
            onChangeQuery={(text) => (text ? searchPlaces(text) : clearSearch())}
            sport={sportFilter}
            onChangeSport={setSportFilter}
            onSubmit={() => {
              const best = searchResults[0];
              if (best) openPlace(best);
              else Keyboard.dismiss();
            }}
          />

          {searchResults.length > 0 && (
            <ThemedView
              style={[
                styles.searchResults,
                theme.shadows.overlay,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              {searchResults.map((result) => (
                <Pressable
                  key={result.id}
                  style={styles.searchResultRow}
                  onPress={() => openPlace(result)}
                  accessibilityRole="button"
                >
                  <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" numberOfLines={1} style={styles.resultName}>
                    {result.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}
          {searchLoading && (
            <View style={[styles.searchStatusRow, statusSurface]} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <ThemedText type="caption" themeColor="textSecondary">
                Searching…
              </ThemedText>
            </View>
          )}
          {searchedFor && searchResults.length === 0 && !searchLoading && !searchError && (
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              style={[styles.searchStatusRow, statusSurface]}
              accessibilityLiveRegion="polite"
            >
              {`No places found for "${searchedFor}"`}
            </ThemedText>
          )}
          {searchError && (
            <View style={[styles.searchStatusRow, statusSurface]} accessibilityLiveRegion="polite">
              <ThemedText type="caption" themeColor="dangerText">
                {searchError}
              </ThemedText>
              <Tappable
                onPress={() => searchPlaces(searchQuery)}
                hitSlop={12}
                accessibilityRole="button"
              >
                <ThemedText type="caption" style={{ color: theme.accentText }}>
                  Try again
                </ThemedText>
              </Tappable>
            </View>
          )}

          <MapChips chips={chips} />

          {showOthers && (
            <View style={styles.legend}>
              {othersLoading && <ActivityIndicator size="small" color={theme.textSecondary} />}
              <MapLegend
                items={[
                  { label: 'Yours', color: theme.brand.primary },
                  { label: 'Others', color: OTHERS_TERRITORY_COLOR },
                ]}
              />
            </View>
          )}
          {showHeatmap && heatmapPoints.length > 0 && (
            <View style={styles.legend}>
              <MapLegend
                items={[
                  { label: 'Fewer activities', color: heatRamp[1]?.[1] ?? theme.textSecondary },
                  { label: 'More', color: heatRamp.at(-2)?.[1] ?? theme.text },
                ]}
              />
            </View>
          )}
          {!online && (
            <View
              style={[styles.offlineStrip, { backgroundColor: theme.backgroundElement }]}
              accessibilityLiveRegion="polite"
            >
              <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.offlineText}>
                You're offline. Your own routes and territory are still here.
              </ThemedText>
              {downloadedRoutes.size > 0 && (
                <Tappable
                  onPress={() => router.push('/saved-routes?downloaded=1')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See the routes saved for offline use"
                >
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    Offline routes
                  </ThemedText>
                </Tappable>
              )}
            </View>
          )}
          {showOthers && !othersLoading && othersTerritories.length === 0 ? (
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              style={[styles.searchStatusRow, statusSurface]}
              accessibilityLiveRegion="polite"
            >
              No one else's territory around here yet
            </ThemedText>
          ) : null}
          {showHeatmap && heatmapPoints.length === 0 ? (
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              style={[styles.searchStatusRow, statusSurface]}
              accessibilityLiveRegion="polite"
            >
              Nothing to show on the heatmap yet. Record an activity or turn on Others.
            </ThemedText>
          ) : null}
          {!location && !errorMsg ? (
            <View style={[styles.searchStatusRow, statusSurface]} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <ThemedText type="caption" themeColor="textSecondary">
                Finding your location…
              </ThemedText>
            </View>
          ) : null}

          {!location && errorMsg ? (
            <ThemedView
              style={[styles.locationBanner, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="small" style={{ flex: 1, color: theme.textSecondary }}>
                {errorMsg}
              </ThemedText>
              <Tappable onPress={loadLocation} hitSlop={8} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                  Try again
                </ThemedText>
              </Tappable>
            </ThemedView>
          ) : null}
        </View>
      )}

      {/* Rides on top of the sheet, wherever the athlete has dragged it; a place card takes its spot. */}
      {!mapOnly && !poi && (
        <Animated.View style={[styles.locateSlot, locateSlotStyle]} pointerEvents="box-none">
          <Tappable
            style={[
              styles.locate,
              theme.shadows.raised,
              { backgroundColor: theme.backgroundElement },
            ]}
            onPress={() => {
              Keyboard.dismiss();
              dismissResults();
              setMapOnly(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Map only: hide the controls"
          >
            <Ionicons name="expand-outline" size={22} color={theme.text} />
          </Tappable>
          <Tappable
            style={[
              styles.locate,
              theme.shadows.raised,
              { backgroundColor: theme.backgroundElement },
            ]}
            onPress={toggleTilt}
            accessibilityRole="button"
            accessibilityState={{ selected: tilted }}
            accessibilityLabel={tilted ? 'Switch to a flat map' : 'Tilt the map in 3D'}
          >
            <ThemedText
              type="smallBold"
              style={{ color: tilted ? theme.brand.primary : theme.text }}
            >
              3D
            </ThemedText>
          </Tappable>
          <Tappable
            style={[
              styles.locate,
              theme.shadows.raised,
              { backgroundColor: theme.backgroundElement },
            ]}
            onPress={() => setStyleMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={layersBadge > 0 ? `Map layers, ${layersBadge} on` : 'Map layers'}
          >
            <Ionicons name="layers-outline" size={24} color={theme.text} />
            {layersBadge > 0 && (
              <View style={[styles.layersBadge, { backgroundColor: theme.brand.primary }]}>
                <ThemedText type="eyebrow" style={styles.layersBadgeText}>
                  {layersBadge}
                </ThemedText>
              </View>
            )}
          </Tappable>
          <Tappable
            style={[
              styles.locate,
              theme.shadows.raised,
              { backgroundColor: theme.backgroundElement },
            ]}
            onPress={() => {
              // Idle: come back to me and follow. Following: face the way I am heading. Heading: stop.
              if (followMode === null) recenter();
              toggleFollow();
            }}
            accessibilityRole="button"
            accessibilityLabel={LOCATE_LABEL[followMode ?? 'off']}
          >
            <Ionicons
              name={LOCATE_ICON[followMode ?? 'off']}
              size={24}
              color={followMode ? theme.brand.primary : theme.textSecondary}
            />
          </Tappable>
        </Animated.View>
      )}

      {!mapOnly && (
        <MapBottomSheet
          height={sheetHeight}
          onPreviewRoute={setPreview}
          previewId={preview?.id ?? null}
        />
      )}
      {poi && !selectedTerritory && (
        <PoiCard
          poi={poi}
          from={location}
          sport={sportFilter}
          onClose={() => setPoi(null)}
          onRouteHere={(place) => openBuilder({ to: place.coordinate })}
          onStartHere={(place) => openBuilder({ from: place.coordinate })}
          onLoopsFromHere={(place) => openBuilder({ from: place.coordinate, loop: true })}
        />
      )}
      {/* After the map sheet, so a tapped territory's card sits on top of it instead of behind. */}
      {selectedTerritory && (
        <TerritorySheet
          territory={selectedTerritory}
          loading={territoryLoading}
          onClose={closeTerritory}
        />
      )}
      <MapLayersSheet
        visible={styleMenuOpen}
        onClose={() => setStyleMenuOpen(false)}
        layers={['routes', 'heatmap', 'others', 'poi', 'bikeLanes']}
        previewCenter={location ? [location.longitude, location.latitude] : null}
      />
      <ActionSheet
        visible={distanceMenuOpen}
        title="Route distance"
        actions={distanceActions}
        onClose={() => setDistanceMenuOpen(false)}
      />
      <ActionSheet
        visible={timeMenuOpen}
        title="Show activity from"
        actions={timeActions}
        onClose={() => setTimeMenuOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  offlineText: { flex: 1 },
  offlineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  locationBanner: {
    // Clear of the compass at the top right.
    marginRight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  container: {
    flex: 1,
  },

  topToolbar: {
    position: 'absolute',
    left: MapChrome.edge,
    right: MapChrome.edge,
    gap: MapChrome.gap,
  },
  searchResults: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  resultName: { flex: 1 },
  // A solid pill, so the line stays readable over satellite imagery and busy maps.
  searchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.lg,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  locateSlot: {
    position: 'absolute',
    right: MapChrome.edge,
    bottom: MapChrome.edge,
    gap: Spacing.two,
  },
  mapOnlyExit: { position: 'absolute', right: MapChrome.edge, zIndex: 2 },
  locate: {
    width: MapChrome.fab,
    height: MapChrome.fab,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layersBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layersBadgeText: { color: Brand.white, fontSize: 11, lineHeight: 14 },
});
