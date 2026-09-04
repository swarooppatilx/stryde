import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivityStore } from '@/stores/activityStore';
import { useSocialStore } from '@/stores/socialStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { formatArea, formatDistance, formatDuration } from '@/utils/format';
import { haptics } from '@/utils/haptics';

type SnapPoint = 'collapsed' | 'peek' | 'expanded';

const COLLAPSED_HEIGHT = 24;
const PEEK_HEIGHT = 200;
const EXPANDED_HEIGHT = 420;

const SPRING_CONFIG = { damping: 22, stiffness: 200 };

function getTargetHeight(point: SnapPoint): number {
  switch (point) {
    case 'collapsed':
      return COLLAPSED_HEIGHT;
    case 'peek':
      return PEEK_HEIGHT;
    case 'expanded':
      return EXPANDED_HEIGHT;
  }
}

export function MapBottomSheet() {
  const theme = useTheme();
  const router = useRouter();
  const userActivities = useActivityStore((s) => s.activities);
  const socialActivities = useSocialStore((s) => s.activities);
  const totalArea = useTerritoryStore((s) => s.getTotalArea(getCurrentUserId()));
  const polygonCount = useTerritoryStore((s) => s.getUserPolygons(getCurrentUserId()).length);

  // Starting fully collapsed leaves only a sliver that's hard to notice or
  // hit - default to 'peek' so territory/route info is visible immediately.
  const [snap, setSnap] = useState<SnapPoint>('peek');
  const animatedHeight = useSharedValue(PEEK_HEIGHT);

  const recentWithRoute = [...userActivities, ...socialActivities]
    .filter((a) => a.polyline?.includes(','))
    .slice(0, 5);

  // Animate height when snap changes
  useEffect(() => {
    animatedHeight.value = withSpring(getTargetHeight(snap), SPRING_CONFIG);
  }, [snap, animatedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const navigateSnap = useCallback((direction: 'up' | 'down') => {
    haptics.tap();
    setSnap((prev) => {
      if (direction === 'up') {
        if (prev === 'collapsed') return 'peek';
        if (prev === 'peek') return 'expanded';
        return 'expanded';
      }
      if (prev === 'expanded') return 'peek';
      if (prev === 'peek') return 'collapsed';
      return 'collapsed';
    });
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationY < -20 || event.velocityY < -500) {
        runOnJS(navigateSnap)('up');
      } else if (event.translationY > 20 || event.velocityY > 500) {
        runOnJS(navigateSnap)('down');
      }
    });

  const isCollapsed = snap === 'collapsed';
  const isExpanded = snap === 'expanded';

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
          {
            backgroundColor: theme.backgroundElement,
            bottom: 0,
            paddingTop: isCollapsed ? Spacing.one : Spacing.two,
            paddingBottom: isCollapsed ? Spacing.one : Spacing.three,
          },
        ]}
      >
        {/* Handle - tappable to toggle */}
        <TouchableOpacity
          onPress={() => navigateSnap(isCollapsed ? 'up' : 'down')}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>
        </TouchableOpacity>

        {/* Collapsed: no content — just the handle */}

        {/* Peek / Expanded: full content */}
        {!isCollapsed && (
          <>
            {totalArea > 0 && (
              <ThemedView
                style={[styles.territoryBanner, { backgroundColor: theme.backgroundSelected }]}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={theme.text} />
                <ThemedView style={styles.territoryInfo}>
                  <ThemedText type="smallBold" style={{ color: theme.text }}>
                    {formatArea(totalArea)} captured
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {polygonCount} {polygonCount === 1 ? 'territory' : 'territories'}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            )}

            {recentWithRoute.length > 0 && (
              <ThemedView style={styles.routesSection}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText type="sectionTitle" style={{ color: theme.text }}>
                    Recent Routes
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/activities')}
                    accessibilityRole="button"
                    accessibilityLabel="View all activities"
                  >
                    <ThemedText type="small" style={{ color: theme.brand.primary }}>
                      View all
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                {recentWithRoute.slice(0, isExpanded ? 5 : 2).map((activity) => (
                  <TouchableOpacity
                    key={activity.id}
                    style={[styles.routeCard, { backgroundColor: theme.background }]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/activity-summary?id=${activity.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${activity.name}, ${formatDistance(activity.distance)}`}
                  >
                    <ThemedView style={styles.routeIcon}>
                      <Ionicons
                        name={activity.activityType === 'ride' ? 'bicycle-outline' : 'walk-outline'}
                        size={20}
                        color={theme.textSecondary}
                      />
                    </ThemedView>
                    <ThemedView style={styles.routeInfo}>
                      <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.text }}>
                        {activity.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {formatDistance(activity.distance)} · {formatDuration(activity.duration)}
                      </ThemedText>
                    </ThemedView>
                    <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ThemedView>
            )}

            {recentWithRoute.length === 0 && totalArea === 0 && (
              <ThemedView style={styles.emptyState}>
                <Ionicons name="map-outline" size={28} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, textAlign: 'center' }}
                >
                  Start an activity to see your routes and captured territory here
                </ThemedText>
              </ThemedView>
            )}
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  territoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.three,
  },
  territoryInfo: {
    gap: 2,
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
    gap: 2,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
});
