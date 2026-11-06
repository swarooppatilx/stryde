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
import { ActivityRow } from '@/components/activity-row';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useTerritorySummary } from '@/hooks/useTerritorySummary';
import { useActivityStore } from '@/stores/activityStore';
import { type SavedRoute, useRouteStore } from '@/stores/routeStore';
import { activitySubline } from '@/utils/activitySubline';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { formatArea, formatDistance } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { countOf } from '@/utils/plural';
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
    confirmDestructive({
      title: 'Remove saved route?',
      message: route.name,
      confirmLabel: 'Remove',
      onConfirm: () => removeRoute(route.id),
    });
  };
  const recent = userActivities.slice(0, 5);

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
              <ActivityRow
                key={route.id}
                variant="compact"
                saved
                title={route.name}
                meta={formatDistance(route.distance, unitSystem)}
                sport={route.sport}
                polyline={route.polyline}
                onPress={() => {
                  haptics.selection();
                  onPreviewRoute(route);
                }}
                accessibilityState={{ selected: previewId === route.id }}
                accessibilitySuffix="Show on map"
                trailing={
                  <Tappable
                    onPress={() => confirmRemove(route)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${route.name} from saved routes`}
                  >
                    <Ionicons name="bookmark" size={IconSize.inline} color={theme.brand.primary} />
                  </Tappable>
                }
              />
            ))}
          </ThemedView>
        )}

        {recent.length > 0 && (
          <ThemedView style={styles.routesSection}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="sectionTitle" style={{ color: theme.text }}>
                Recent activities
              </ThemedText>
              <Tappable
                onPress={() => router.push('/activities')}
                accessibilityRole="button"
                accessibilityLabel="View all activities"
              >
                <ThemedText type="small" style={{ color: theme.accentText }}>
                  View all
                </ThemedText>
              </Tappable>
            </ThemedView>

            {recent.slice(0, isExpanded ? 5 : 2).map((activity) => (
              <ActivityRow
                key={activity.id}
                variant="compact"
                title={activity.name || 'Activity'}
                meta={activitySubline(activity, unitSystem)}
                sport={activity.activityType}
                polyline={activity.polyline}
                onPress={() => router.push(`/activities/${activity.id}`)}
                trailing={
                  <Ionicons
                    name="chevron-forward"
                    size={IconSize.badge}
                    color={theme.textSecondary}
                  />
                }
              />
            ))}
          </ThemedView>
        )}

        {recent.length === 0 && totalArea === 0 && (
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
});
