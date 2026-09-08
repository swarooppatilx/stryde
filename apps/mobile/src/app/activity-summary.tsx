import { Input } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { ElevationChart } from '@/components/elevation-chart';
import { IconBadge } from '@/components/icon-badge';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { PhotoGrid } from '@/components/photo-grid';
import { ShareRouteImage } from '@/components/share-route-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon } from '@/constants/activity';
import { MAP_STYLES } from '@/constants/config';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivity } from '@/hooks/useActivity';
import { useActivityStore } from '@/stores/activityStore';
import { formatArea, formatDistance, formatDurationLong, formatPace } from '@/utils/format';
import { computePersonalRecords } from '@/utils/profile';

export default function ActivitySummaryScreen() {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
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

  const [showShareImage, setShowShareImage] = useState(false);

  const allActivities = useActivityStore((s) => s.activities);
  const newRecords = useMemo(() => {
    if (!activity) return [];
    const priorSameSport = allActivities.filter(
      (a) => a.id !== activity.id && a.activityType === activity.activityType
    );
    if (priorSameSport.length === 0) return [];
    const prior = computePersonalRecords(priorSameSport);
    const records: string[] = [];
    if (prior.longestDistance && activity.distance > prior.longestDistance.distance) {
      records.push('longest distance');
    }
    if (
      prior.fastestPace &&
      activity.distance > 0 &&
      prior.fastestPace.distance > 0 &&
      activity.duration / activity.distance <
        prior.fastestPace.duration / prior.fastestPace.distance
    ) {
      records.push('fastest pace');
    }
    if (prior.longestDuration && activity.duration > prior.longestDuration.duration) {
      records.push('longest duration');
    }
    return records;
  }, [activity, allActivities]);

  const handleSharePress = useCallback(async () => {
    setShowShareImage(true);
    await handleShare();
    setShowShareImage(false);
  }, [handleShare]);

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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
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

            {(newRecords.length > 0 || (!!activity.strdEarned && activity.strdEarned > 0)) && (
              <ThemedView style={styles.highlightsRow}>
                {newRecords.length > 0 && (
                  <ThemedView
                    style={[
                      styles.highlightChip,
                      { backgroundColor: tint(theme.brand.warning, 0.15) },
                    ]}
                  >
                    <Ionicons name="trophy" size={14} color={theme.brand.warning} />
                    <ThemedText type="caption" style={{ color: theme.brand.warning }}>
                      {`New ${newRecords[0]}!`}
                      {newRecords.length > 1 ? ` +${newRecords.length - 1}` : ''}
                    </ThemedText>
                  </ThemedView>
                )}

                {!!activity.strdEarned && activity.strdEarned > 0 && (
                  <ThemedView
                    style={[
                      styles.highlightChip,
                      { backgroundColor: tint(theme.brand.warning, 0.15) },
                    ]}
                  >
                    {/* Placeholder icon — swap for the custom STRD coin icon once ready */}
                    <Ionicons name="disc" size={14} color={theme.brand.warning} />
                    <ThemedText type="caption" style={{ color: theme.brand.warning }}>
                      {`+${activity.strdEarned.toFixed(2)} STRD`}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            )}

            <ThemedView style={styles.stats}>
              <ThemedView style={styles.stat}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Distance
                </ThemedText>
                <ThemedText type="subtitle">
                  {formatDistance(activity.distance, unitSystem)}
                </ThemedText>
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
                  {formatPace(activity.distance, activity.duration, unitSystem)}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.stat}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Territory
                </ThemedText>
                <ThemedText type="subtitle">
                  {activity.territory ? formatArea(activity.territoryArea, unitSystem) : '—'}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            {activity.txHash && (
              <ThemedView style={styles.txRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Tx Hash
                </ThemedText>
                <TouchableOpacity
                  onPress={() => Clipboard.setStringAsync(activity.txHash!)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copy transaction hash"
                >
                  <ThemedText type="small" style={{ color: theme.brand.primary }}>
                    {activity.txHash.slice(0, 10)}...{activity.txHash.slice(-8)}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )}

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

            {/* Feel & Privacy badges */}
            {(activity.feel || activity.privacy) && (
              <ThemedView style={styles.badgeRow}>
                {activity.feel && (
                  <ThemedView style={[styles.badge, { backgroundColor: theme.brand.primaryTint }]}>
                    <ThemedText type="caption" style={{ color: theme.brand.primary }}>
                      {activity.feel === 'great'
                        ? '😍'
                        : activity.feel === 'good'
                          ? '😊'
                          : activity.feel === 'ok'
                            ? '😐'
                            : activity.feel === 'bad'
                              ? '😕'
                              : '😫'}{' '}
                      {activity.feel.charAt(0).toUpperCase() + activity.feel.slice(1)}
                    </ThemedText>
                  </ThemedView>
                )}
                {activity.privacy && (
                  <ThemedView style={[styles.badge, { backgroundColor: theme.brand.primaryTint }]}>
                    <Ionicons
                      name={
                        activity.privacy === 'everyone'
                          ? 'globe-outline'
                          : activity.privacy === 'followers'
                            ? 'people-outline'
                            : 'lock-closed-outline'
                      }
                      size={14}
                      color={theme.brand.primary}
                    />
                    <ThemedText type="caption" style={{ color: theme.brand.primary }}>
                      {activity.privacy === 'everyone'
                        ? 'Everyone'
                        : activity.privacy === 'followers'
                          ? 'Followers'
                          : 'Only Me'}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            )}

            {/* Photos */}
            {activity.images && activity.images.length > 0 && (
              <ThemedView style={styles.photoSection}>
                <PhotoGrid photos={activity.images} maxHeight={200} />
              </ThemedView>
            )}

            {/* Description */}
            {activity.description && (
              <ThemedView style={styles.descriptionSection}>
                <ThemedText type="small" style={{ color: theme.text }}>
                  {activity.description}
                </ThemedText>
              </ThemedView>
            )}

            <ThemedView style={styles.actions}>
              <AppButton onPress={goBack} fullWidth={false} style={styles.doneButton}>
                Done
              </AppButton>

              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.backgroundSelected }]}
                onPress={handleSharePress}
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
          </ScrollView>
        </ThemedView>
      </SafeAreaView>

      {showShareImage && (
        <View ref={viewRef} style={styles.shareImageContainer} pointerEvents="none">
          <ShareRouteImage
            coordinates={coordinates}
            territory={activity.territory}
            territoryArea={activity.territoryArea}
            distance={activity.distance}
            duration={activity.duration}
          />
        </View>
      )}
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
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    paddingBottom: Spacing.six,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  statsScroll: {
    padding: Spacing.four,
    gap: Spacing.three,
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
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    top: -10000,
    left: 0,
    width: 1080,
    height: 1080,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
  },
  photoSection: {
    marginTop: Spacing.two,
  },
  descriptionSection: {
    marginTop: Spacing.two,
  },
});
