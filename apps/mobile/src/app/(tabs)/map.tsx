import { Result } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker } from '@maplibre/maplibre-react-native';
import { ActivityIndicator, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/filter-chips';
import { MapBottomSheet } from '@/components/map-bottom-sheet';
import { MapRoute } from '@/components/map-route';
import { SearchBar } from '@/components/search-bar';
import { TerritorySheet } from '@/components/territory-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MAP_STYLES } from '@/constants/config';
import { BorderRadius, Brand, Shadow, ShadowDark, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type TimeFilter, useMap } from '@/hooks/useMap';

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
    setSportFilter,
    setTimeFilter,
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
  } = useMap();
  // Bottom edge of the right-hand control stack (7 × 44px buttons, gaps, and
  // 2 dividers) so MapLibre's native compass renders below it, not behind it.
  const controlCount = 7;
  const dividerCount = 2;
  const controlStackHeight =
    44 * controlCount + Spacing.two * (controlCount + dividerCount - 1) + dividerCount * 5;
  const compassTopOffset = insets.top + 16 + controlStackHeight + Spacing.three;

  return (
    <ThemedView type="background" style={styles.container}>
      {location ? (
        <>
          <MapRoute
            cameraRef={cameraRef}
            territoryPolygons={userPolygons}
            territoryIds={territoryIds}
            territoryColor={theme.brand.primary}
            territoryOpacity={0.22}
            othersTerritories={othersTerritories}
            othersTerritoryColor="#7c3aed"
            othersTerritoryOpacity={0.14}
            followUser={followMode ?? undefined}
            initialCenter={[location.longitude, location.latitude]}
            initialZoom={15}
            mapStyleUrl={theme.isDark ? MAP_STYLES.darkMatter : MAP_STYLES.voyager}
            activityRoutes={activityRoutes}
            compassTopOffset={compassTopOffset}
            heatmapPoints={heatmapPoints}
            heatmapVisible={showHeatmap}
            onTerritoryPress={handleTerritoryPress}
            onZoomChanged={onMapZoomChanged}
          />

          {focusedPlace && (
            <Marker lngLat={[focusedPlace.longitude, focusedPlace.latitude]}>
              <View style={[styles.focusedPin, { backgroundColor: theme.brand.primary }]}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {/* Search + filters */}
          <ThemedView style={[styles.topToolbar, { top: insets.top + 8 }]}>
            <SearchBar
              value={searchQuery}
              onChangeText={(text) => (text ? searchPlaces(text) : clearSearch())}
              placeholder="Search for a place on the map"
              style={styles.searchBar}
            />

            {searchResults.length > 0 && (
              <ThemedView style={[styles.searchResults, { borderColor: theme.border }]}>
                {searchResults.map((result) => (
                  <Pressable
                    key={result.id}
                    style={styles.searchResultRow}
                    onPress={() => focusPlace(result)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                    <ThemedText
                      type="small"
                      numberOfLines={1}
                      style={{ flex: 1, color: theme.text }}
                    >
                      {result.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            )}
            {searchLoading && (
              <View style={styles.searchStatusRow}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Searching…
                </ThemedText>
              </View>
            )}
            {searchError && (
              <ThemedText type="caption" style={[styles.searchStatusRow, { color: Brand.danger }]}>
                {searchError}
              </ThemedText>
            )}

            <FilterChips value={sportFilter} onChange={setSportFilter} />

            <View style={styles.timeRow}>
              {TIME_FILTERS.map((f) => {
                const active = timeFilter === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    onPress={() => setTimeFilter(f.value)}
                    activeOpacity={0.7}
                    style={[
                      styles.timeChip,
                      {
                        // Solid fill — a translucent tint reads as washed out over the map.
                        backgroundColor: active ? theme.brand.primary : theme.backgroundElement,
                        borderColor: active ? theme.brand.primary : theme.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: active ? '#fff' : theme.textSecondary }}
                    >
                      {f.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}

              {showOthers && othersLoading && (
                <View style={styles.timeChip}>
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                </View>
              )}
            </View>
          </ThemedView>

          {/* Map Controls */}
          <ThemedView style={[styles.controls, { top: insets.top + 16 }]}>
            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                {
                  backgroundColor: showRoutes
                    ? tint(theme.brand.primary, 0.12)
                    : theme.backgroundElement,
                },
              ]}
              onPress={toggleRoutes}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle activity routes"
              accessibilityState={{ selected: showRoutes }}
            >
              <Ionicons
                name="map"
                size={20}
                color={showRoutes ? theme.brand.primary : theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                {
                  backgroundColor: showHeatmap
                    ? tint(theme.brand.primary, 0.12)
                    : theme.backgroundElement,
                },
              ]}
              onPress={toggleHeatmap}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle activity heatmap"
              accessibilityState={{ selected: showHeatmap }}
            >
              <Ionicons
                name="flame"
                size={20}
                color={showHeatmap ? theme.brand.primary : theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                {
                  backgroundColor: showOthers
                    ? tint(theme.brand.primary, 0.12)
                    : theme.backgroundElement,
                },
              ]}
              onPress={toggleOthers}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle other riders' routes"
              accessibilityState={{ selected: showOthers }}
            >
              <Ionicons
                name="people"
                size={20}
                color={showOthers ? theme.brand.primary : theme.text}
              />
            </TouchableOpacity>

            <ToolbarDivider />

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={zoomIn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <Ionicons name="add" size={22} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={zoomOut}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <Ionicons name="remove" size={22} color={theme.text} />
            </TouchableOpacity>

            <ToolbarDivider />

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                {
                  backgroundColor: followMode ? theme.brand.primaryTint : theme.backgroundElement,
                },
              ]}
              onPress={toggleFollow}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle location follow"
              accessibilityState={{ selected: !!followMode }}
            >
              <Ionicons
                name={followMode === 'heading' ? 'compass' : 'locate'}
                size={20}
                color={followMode ? theme.brand.primary : theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={recenter}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Recenter map"
            >
              <Ionicons name="navigate" size={20} color={theme.brand.primary} />
            </TouchableOpacity>
          </ThemedView>

          {selectedTerritory && (
            <TerritorySheet
              territory={selectedTerritory}
              loading={territoryLoading}
              onClose={closeTerritory}
            />
          )}

          <MapBottomSheet />
        </>
      ) : (
        <ThemedView style={styles.loadingContainer}>
          {errorMsg ? (
            <Result
              img={<Ionicons name="location-outline" size={48} color={theme.textSecondary} />}
              title={errorMsg}
              buttonText="Try Again"
              onButtonClick={loadLocation}
            />
          ) : (
            <ThemedText type="small">Loading map...</ThemedText>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

function ToolbarDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  topToolbar: {
    position: 'absolute',
    left: Spacing.three,
    // Leave a gutter for the 44px control column on the right so the filter
    // chips don't scroll underneath it.
    right: Spacing.three + 44 + Spacing.two,
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  searchBar: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  searchResults: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  searchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  timeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  controls: {
    position: 'absolute',
    right: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(127,127,127,0.35)',
    marginVertical: 2,
  },
  focusedPin: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
