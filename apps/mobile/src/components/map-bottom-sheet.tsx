import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon } from '@/constants/activity';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useTerritorySummary } from '@/hooks/useTerritorySummary';
import { useActivityStore } from '@/stores/activityStore';
import { type SavedRoute, useRouteStore } from '@/stores/routeStore';
import { Alert } from '@/utils/alert';
import { formatArea, formatDistance, formatDuration } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { countOf } from '@/utils/plural';
import { recentRoutes } from '@/utils/recentRoutes';
import { visibleSavedRoutes } from '@/utils/savedRoutesList';
import { SHEET_SNAP_POINTS } from '@/utils/sheetSnap';
import { ListMessage } from './list-message';

interface MapBottomSheetProps {
  /** The sheet's height, shared so the map's floating buttons can ride above it. */
  height: SharedValue<number>;
  /** A saved route was tapped: show it on the map. */
  onPreviewRoute: (route: SavedRoute) => void;
  /** The saved route now drawn on the map, if any. */
  previewId: string | null;
}

export function MapBottomSheet({ height, onPreviewRoute, previewId }: MapBottomSheetProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const router = useRouter();
  const userActivities = useActivityStore((s) => s.activities);
  const userId = useCurrentUserId();
  const { totalArea, polygons } = useTerritorySummary(userId);
  const polygonCount = polygons.length;

  // Fully collapsed leaves only a sliver that is hard to notice or hit, so start at the middle point.
  const [index, setIndex] = useState(PEEK_INDEX);
  const animatedIndex = useSharedValue<number>(PEEK_INDEX);

  const savedRoutes = useRouteStore((s) => s.routes);
  const removeRoute = useRouteStore((s) => s.remove);
  // A bookmark icon sits inside a tappable card, so a slip of the thumb removes a route; ask first.
  const confirmRemove = (route: SavedRoute) => {
    Alert.alert('Remove saved route?', route.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeRoute(route.id) },
    ]);
  };
  const recentWithRoute = recentRoutes(userActivities, 5);

  // The map's floating buttons ride on the sheet's height, so it follows the sheet while it is dragged.
  useAnimatedReaction(
    () => animatedIndex.value,
    (current) => {
      height.value = interpolate(
        current,
        [0, 1, 2],
        SHEET_SNAP_POINTS as unknown as number[],
        Extrapolation.CLAMP
      );
    }
  );

  const isExpanded = index === SHEET_SNAP_POINTS.length - 1;

  return (
    <BottomSheet
      index={PEEK_INDEX}
      snapPoints={SHEET_SNAP_POINTS as unknown as number[]}
      animatedIndex={animatedIndex}
      onChange={setIndex}
      enableDynamicSizing={false}
      enableOverDrag={false}
      style={theme.shadows.sheet}
      backgroundStyle={[styles.background, { backgroundColor: theme.backgroundElement }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: theme.border }]}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        {totalArea > 0 && (
          <ThemedView
            style={[styles.territoryBanner, { backgroundColor: theme.backgroundSelected }]}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.text} />
            <ThemedView style={styles.territoryInfo}>
              <ThemedText type="smallBold" style={{ color: theme.text }}>
                {formatArea(totalArea, unitSystem)} captured
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {countOf(polygonCount, 'territory', 'territories')}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        )}

        {savedRoutes.length > 0 && (
          <ThemedView style={styles.routesSection}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="sectionTitle" style={{ color: theme.text }}>
                Saved routes
              </ThemedText>
              <Tappable
                onPress={() => router.push('/saved-routes')}
                accessibilityRole="button"
                accessibilityLabel="See all saved routes"
              >
                <ThemedText type="small" style={{ color: theme.accentText }}>
                  See all
                </ThemedText>
              </Tappable>
            </ThemedView>
            {visibleSavedRoutes(savedRoutes, isExpanded).map((route) => (
              <Tappable
                key={route.id}
                style={[styles.routeCard, { backgroundColor: theme.background }]}
                activeOpacity={0.7}
                onPress={() => {
                  haptics.selection();
                  onPreviewRoute(route);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: previewId === route.id }}
                accessibilityLabel={`${route.name}, ${formatDistance(route.distance, unitSystem)}. Show on map`}
              >
                <ThemedView style={styles.routeIcon}>
                  <Ionicons
                    name={getSportIcon(route.sport)}
                    size={20}
                    color={theme.brand.primary}
                  />
                </ThemedView>
                <ThemedView style={styles.routeInfo}>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.text }}>
                    {route.name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatDistance(route.distance, unitSystem)}
                  </ThemedText>
                </ThemedView>
                <Tappable
                  onPress={() => confirmRemove(route)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${route.name} from saved routes`}
                >
                  <Ionicons name="bookmark" size={18} color={theme.brand.primary} />
                </Tappable>
              </Tappable>
            ))}
          </ThemedView>
        )}

        {recentWithRoute.length > 0 && (
          <ThemedView style={styles.routesSection}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="sectionTitle" style={{ color: theme.text }}>
                Recent activities
              </ThemedText>
              <Tappable
                onPress={() => router.push('/(tabs)/profile')}
                accessibilityRole="button"
                accessibilityLabel="View all activities"
              >
                <ThemedText type="small" style={{ color: theme.accentText }}>
                  View all
                </ThemedText>
              </Tappable>
            </ThemedView>

            {recentWithRoute.slice(0, isExpanded ? 5 : 2).map((activity) => (
              <Tappable
                key={activity.id}
                style={[styles.routeCard, { backgroundColor: theme.background }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/activities/${activity.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${activity.name}, ${formatDistance(activity.distance, unitSystem)}`}
              >
                <ThemedView style={styles.routeIcon}>
                  <Ionicons
                    name={getSportIcon(activity.activityType)}
                    size={20}
                    color={theme.textSecondary}
                  />
                </ThemedView>
                <ThemedView style={styles.routeInfo}>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.text }}>
                    {activity.name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatDistance(activity.distance, unitSystem)} ·{' '}
                    {formatDuration(activity.duration)}
                  </ThemedText>
                </ThemedView>
                <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
              </Tappable>
            ))}
          </ThemedView>
        )}

        {recentWithRoute.length === 0 && totalArea === 0 && (
          <ListMessage
            icon="map-outline"
            text="Start an activity to see your routes and captured territory here"
          />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const PEEK_INDEX = 1;

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  background: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl },
  handle: { width: 36, height: 4 },
  territoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.three,
  },
  territoryInfo: {
    gap: Spacing.half,
  },
  routesSection: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  routeIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeInfo: {
    flex: 1,
    gap: Spacing.half,
  },
});
