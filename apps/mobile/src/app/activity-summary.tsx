import { Input } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivity } from '@/hooks/useActivity';
import { formatArea, formatDistance, formatDurationLong, formatPace } from '@/utils/format';
import { haptics } from '@/utils/haptics';

const MAX_SHEET_RATIO = 0.62;
const SHEET_SPRING = { damping: 22, stiffness: 200 };

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
    svgRef,
    handleDelete,
    handleStartEditName,
    handleSaveName,
    handleShare,
    handleCopy,
    handleDownload,
    goBack,
  } = useActivity();

  const insets = useSafeAreaInsets();
  // Sized to the measured content (header + stats/actions) rather than a fixed
  // fraction of the screen, so a short activity doesn't leave an empty band
  // under the action row. Capped so the map always keeps some room.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const maxSheetHeight = Dimensions.get('window').height * MAX_SHEET_RATIO;
  const collapsedSheetHeight = (headerHeight || 150) + insets.bottom;
  const expandedSheetHeight = Math.min(
    (headerHeight || 150) + (bodyHeight || maxSheetHeight) + insets.bottom,
    maxSheetHeight
  );
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const sheetHeight = useSharedValue(maxSheetHeight);

  useEffect(() => {
    sheetHeight.value = withSpring(
      sheetExpanded ? expandedSheetHeight : collapsedSheetHeight,
      SHEET_SPRING
    );
  }, [sheetExpanded, expandedSheetHeight, collapsedSheetHeight, sheetHeight]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({ height: sheetHeight.value }));

  const setExpanded = useCallback((expanded: boolean) => {
    haptics.tap();
    setSheetExpanded(expanded);
  }, []);

  // Pan only on the handle/header strip so it doesn't fight the stats
  // ScrollView underneath.
  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .onEnd((e) => {
          if (e.translationY < -20 || e.velocityY < -500) runOnJS(setExpanded)(true);
          else if (e.translationY > 20 || e.velocityY > 500) runOnJS(setExpanded)(false);
        }),
    [setExpanded]
  );

  useEffect(() => {
    // cameraRef is only attached once MapLibre has mounted its Camera, which
    // happens after this effect first runs — check inside the timer instead.
    if (coordinates.length < 2) return;

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
        // Fit the route into the map area the sheet leaves visible.
        padding: {
          top: pad + 40,
          right: pad,
          bottom: (sheetExpanded ? expandedSheetHeight : collapsedSheetHeight) + pad,
          left: pad,
        },
        duration: 800,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [coordinates, activity?.territory, sheetExpanded, expandedSheetHeight, collapsedSheetHeight]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (coordinates.length > 0) {
      list.push({
        id: 'start',
        coordinate: coordinates[0],
        color: theme.brand.success,
        icon: 'play',
      });
      list.push({
        id: 'end',
        coordinate: coordinates[coordinates.length - 1],
        color: theme.brand.danger,
        icon: 'stop',
      });
    }
    return list;
  }, [coordinates, activity?.territory, theme]);

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

        <Animated.View
          style={[
            styles.statsOverlay,
            sheetAnimatedStyle,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <GestureDetector gesture={sheetPan}>
            <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
              <TouchableOpacity
                onPress={() => setExpanded(!sheetExpanded)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }}
                accessibilityRole="button"
                accessibilityLabel={sheetExpanded ? 'Minimize details' : 'Expand details'}
                style={styles.handleRow}
              >
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
              </TouchableOpacity>
              <View style={styles.sheetHeader}>
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

                {!sheetExpanded && (
                  <TouchableOpacity onPress={() => setExpanded(true)} activeOpacity={0.7}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                      numberOfLines={1}
                    >
                      {formatDistance(activity.distance, unitSystem)} ·{' '}
                      {formatDurationLong(activity.duration)} ·{' '}
                      {formatPace(activity.distance, activity.duration, unitSystem)}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </GestureDetector>

          {sheetExpanded && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.statsScroll}
              onContentSizeChange={(_, h) => setBodyHeight(h)}
            >
              <ThemedView style={styles.stats}>
                <ThemedView style={styles.stat}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Distance
                  </ThemedText>
                  <ThemedText type="subtitle" numberOfLines={1} adjustsFontSizeToFit>
                    {formatDistance(activity.distance, unitSystem)}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.stat}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Duration
                  </ThemedText>
                  <ThemedText type="subtitle" numberOfLines={1} adjustsFontSizeToFit>
                    {formatDurationLong(activity.duration)}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.stat}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Pace
                  </ThemedText>
                  <ThemedText type="subtitle" numberOfLines={1} adjustsFontSizeToFit>
                    {formatPace(activity.distance, activity.duration, unitSystem)}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.stat}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Territory
                  </ThemedText>
                  <ThemedText type="subtitle" numberOfLines={1} adjustsFontSizeToFit>
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
                  onPress={handleCopy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copy route image"
                >
                  <Ionicons name="copy-outline" size={20} color={theme.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: theme.backgroundSelected }]}
                  onPress={handleDownload}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Save route image to device"
                >
                  <Ionicons name="download-outline" size={20} color={theme.text} />
                </TouchableOpacity>

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
            </ScrollView>
          )}
        </Animated.View>
      </SafeAreaView>

      <View style={styles.shareImageContainer} pointerEvents="none">
        <ShareRouteImage
          ref={svgRef}
          coordinates={coordinates}
          territory={activity.territory}
          territoryArea={activity.territoryArea}
          distance={activity.distance}
          duration={activity.duration}
          height={1920}
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
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  statsScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
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
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  stat: {
    width: '50%',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
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
    height: 1920,
  },
  photoSection: {
    marginTop: Spacing.two,
  },
  descriptionSection: {
    marginTop: Spacing.two,
  },
});
