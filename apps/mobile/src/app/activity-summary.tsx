import { Input } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { ElevationChart } from '@/components/elevation-chart';
import { IconBadge } from '@/components/icon-badge';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { ShareRouteImage } from '@/components/share-route-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon } from '@/constants/activity';
import { MAP_STYLES } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivity } from '@/hooks/useActivity';
import { formatArea, formatDistance, formatDurationLong, formatPace } from '@/utils/format';

export default function ActivitySummaryScreen() {
  const theme = useTheme();
  const cameraRef = useRef<CameraRef>(null);
  const {
    activity,
    coordinates,
    isEditingName,
    editedName,
    setEditedName,
    elevationData,
    viewRef,
    handleDelete,
    handleStartEditName,
    handleSaveName,
    handleShare,
    goBack,
  } = useActivity();

  useEffect(() => {
    if (coordinates.length < 2 || !cameraRef.current) return;

    const lngs = coordinates.map((c) => c[0]);
    const lats = coordinates.map((c) => c[1]);

    if (activity?.territory && activity.territory.length > 0) {
      for (const [lng, lat] of activity.territory) {
        lngs.push(lng);
        lats.push(lat);
      }
    }

    const west = Math.min(...lngs);
    const east = Math.max(...lngs);
    const south = Math.min(...lats);
    const north = Math.max(...lats);

    const pad = 50;
    const timer = setTimeout(() => {
      cameraRef.current?.fitBounds([west, south, east, north], {
        padding: { top: pad, right: pad, bottom: pad, left: pad },
        duration: 800,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [coordinates, activity?.territory]);

  if (!activity) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.loadingContainer}>
            <ThemedText type="small">Loading activity...</ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const markers: MapMarker[] = [];
  if (coordinates.length > 0) {
    markers.push({
      id: 'start',
      coordinate: coordinates[0],
      color: theme.brand.success,
      icon: 'play',
    });
    markers.push({
      id: 'end',
      coordinate: coordinates[coordinates.length - 1],
      color: theme.brand.danger,
      icon: 'stop',
    });
  }

  const icon = getSportIcon(activity.activityType);
  const date = new Date(activity.createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {coordinates.length > 0 ? (
          <MapRoute
            cameraRef={cameraRef}
            coordinates={coordinates}
            territoryPolygons={activity.territory ? [activity.territory] : []}
            territoryColor={theme.brand.primary}
            territoryOpacity={0.2}
            markers={markers}
            initialZoom={14}
            showUserLocation={false}
            mapStyleUrl={theme.isDark ? MAP_STYLES.darkMatter : MAP_STYLES.voyager}
          />
        ) : (
          <ThemedView type="background" style={styles.noMap}>
            <Ionicons name="map-outline" size={48} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No route data
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={[styles.statsOverlay, { backgroundColor: theme.backgroundElement }]}>
          <ThemedView style={styles.header}>
            <ThemedView style={styles.headerLeft}>
              <IconBadge size="md" backgroundColor={theme.brand.primaryTint}>
                <Ionicons name={icon} size={20} color={theme.brand.primary} />
              </IconBadge>
              <ThemedView style={styles.headerText}>
                {isEditingName ? (
                  <Input
                    value={editedName}
                    onChangeText={setEditedName}
                    onBlur={handleSaveName}
                    onSubmitEditing={handleSaveName}
                    autoFocus
                    selectTextOnFocus
                    style={styles.nameInput}
                  />
                ) : (
                  <TouchableOpacity onPress={handleStartEditName} activeOpacity={0.7}>
                    <ThemedText type="subtitle">{activity.name}</ThemedText>
                  </TouchableOpacity>
                )}
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {dateStr} at {timeStr}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.stats}>
            <ThemedView style={styles.stat}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Distance
              </ThemedText>
              <ThemedText type="subtitle">{formatDistance(activity.distance)}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Duration
              </ThemedText>
              <ThemedText type="subtitle">{formatDurationLong(activity.duration)}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Pace
              </ThemedText>
              <ThemedText type="subtitle">
                {formatPace(activity.distance, activity.duration)}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Territory
              </ThemedText>
              <ThemedText type="subtitle">
                {activity.territory ? formatArea(activity.territoryArea) : '—'}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {elevationData && (
            <ThemedView style={styles.elevationSection}>
              <ThemedView style={styles.elevationStats}>
                <ThemedView style={styles.elevationStat}>
                  <Ionicons name="arrow-up" size={14} color={theme.brand.success} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {elevationData.totalAscent}m up
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.elevationStat}>
                  <Ionicons name="arrow-down" size={14} color={theme.brand.danger} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {elevationData.totalDescent}m down
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              <ElevationChart elevations={elevationData.elevations} width={280} height={60} />
            </ThemedView>
          )}

          <ThemedView style={styles.actions}>
            <AppButton onPress={goBack} fullWidth={false} style={styles.doneButton}>
              Done
            </AppButton>

            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.backgroundSelected }]}
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share activity"
            >
              <Ionicons name="share-outline" size={20} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.backgroundSelected }]}
              onPress={handleDelete}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete activity"
            >
              <Ionicons name="trash-outline" size={20} color={theme.brand.danger} />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>

      <View ref={viewRef} style={styles.shareImageContainer} pointerEvents="none">
        <ShareRouteImage
          coordinates={coordinates}
          territory={activity.territory}
          territoryArea={activity.territoryArea}
          distance={activity.distance}
          duration={activity.duration}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  noMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  elevationSection: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  elevationStats: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  elevationStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  doneButton: {
    flex: 1,
    borderRadius: BorderRadius.full,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareImageContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1080,
    height: 1080,
    opacity: 0.01,
    zIndex: -1,
  },
});
