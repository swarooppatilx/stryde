import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChipRow } from '@/components/filter-chips';
import { ListMessage } from '@/components/list-message';
import { RouteCard } from '@/components/route-card';
import { RouteFiltersSheet } from '@/components/route-filters-sheet';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDownloadedRouteIds } from '@/hooks/useDownloadedRouteIds';
import { useGoBack } from '@/hooks/useGoBack';
import { type SavedRoute, useRouteStore } from '@/stores/routeStore';
import { confirmDeleteRoute } from '@/utils/confirmDeleteRoute';
import {
  activeFilterCount,
  filterSavedRoutes,
  type RouteFilters,
  routeSportOptions,
} from '@/utils/routeLibrary';

function selectedChip(
  starredOnly: boolean,
  narrowing: number,
  downloadedOnly = false
): 'all' | 'starred' | 'filters' | 'downloaded' {
  if (downloadedOnly) return 'downloaded';
  if (starredOnly) return 'starred';
  return narrowing > 0 ? 'filters' : 'all';
}

/** Every saved route as a card, starred first, narrowed by star and by the filters sheet. */
export default function SavedRoutesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const routes = useRouteStore((s) => s.routes);
  const remove = useRouteStore((s) => s.remove);
  const toggleStar = useRouteStore((s) => s.toggleStar);
  const [filters, setFilters] = useState<RouteFilters>({
    sport: 'all',
    distance: 'any',
    starredOnly: false,
    elevation: 'any',
    difficulty: 'any',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Routes whose map is on the phone; the offline banner on the map links here with this set.
  const downloaded = useDownloadedRouteIds();
  const { downloaded: downloadedParam } = useLocalSearchParams<{ downloaded?: string }>();
  const [downloadedOnly, setDownloadedOnly] = useState(downloadedParam === '1');

  const shown = useMemo(() => {
    const narrowed = filterSavedRoutes(routes, filters);
    return downloadedOnly ? narrowed.filter((r) => downloaded.has(r.id)) : narrowed;
  }, [routes, filters, downloadedOnly, downloaded]);
  const sportOptions = useMemo(() => routeSportOptions(routes), [routes]);
  const narrowing = activeFilterCount(filters);
  const filtered = narrowing > 0 || filters.starredOnly || downloadedOnly;
  const chipValue = selectedChip(filters.starredOnly, narrowing, downloadedOnly);
  const confirmDelete = (route: SavedRoute) =>
    confirmDeleteRoute(route.name, () => remove(route.id));

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            Saved routes
          </ThemedText>
          <Tappable
            onPress={() => router.push('/route-builder')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Plan a route"
          >
            <Ionicons name="add" size={26} color={theme.text} />
          </Tappable>
        </View>
        {routes.length > 0 && (
          <View style={styles.filters}>
            <ChipRow
              options={[
                { value: 'all', label: 'All routes' },
                { value: 'starred', label: 'Starred' },
                ...(downloaded.size > 0 || downloadedOnly
                  ? [{ value: 'downloaded' as const, label: 'Downloaded' }]
                  : []),
                {
                  value: 'filters',
                  label: narrowing > 0 ? `Filters · ${narrowing}` : 'Filters',
                },
              ]}
              value={chipValue}
              onChange={(v) => {
                if (v === 'filters') {
                  setFiltersOpen(true);
                  return;
                }
                setDownloadedOnly(v === 'downloaded');
                setFilters({ ...filters, starredOnly: v === 'starred' });
              }}
              contentStyle={styles.chips}
            />
          </View>
        )}
        <FlatList
          data={shown}
          keyExtractor={(route) => route.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ListMessage
              icon="map-outline"
              text={
                filtered
                  ? 'No saved routes match these filters.'
                  : 'No saved routes yet. Plan one on the map, or save a route from an activity.'
              }
              action={
                filtered
                  ? undefined
                  : { label: 'Plan a route', onPress: () => router.push('/route-builder') }
              }
            />
          }
          renderItem={({ item: route }) => (
            <RouteCard
              route={route}
              onPress={() => router.push(`/routes/${route.id}`)}
              onLongPress={() => confirmDelete(route)}
              onToggleStar={() => toggleStar(route.id)}
              onDelete={() => confirmDelete(route)}
              downloaded={downloaded.has(route.id)}
            />
          )}
        />
        <RouteFiltersSheet
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onChange={setFilters}
          sportOptions={sportOptions}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  filters: { gap: Spacing.two, paddingBottom: Spacing.two },
  chips: { paddingHorizontal: Spacing.four },
  list: { padding: Spacing.four, gap: Spacing.two },
});
