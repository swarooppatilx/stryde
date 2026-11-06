import { Ionicons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityAthleteRow } from '@/components/activity-detail/athlete-row';
import { ActivitySheetBody } from '@/components/activity-detail/sheet-body';
import { ActivitySummaryLine } from '@/components/activity-summary-line';
import { ActivityTitleBlock } from '@/components/activity-title-block';
import { CommentsSheet } from '@/components/comments-sheet';
import { MapLegend } from '@/components/map-legend';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { ShareDesignSheet } from '@/components/share-design-sheet';
import { ShareRouteImage } from '@/components/share-route-image';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon } from '@/constants/activity';
import { Palette } from '@/constants/palette';
import { BorderRadius, IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivity } from '@/hooks/useActivity';
import { useCollapsibleSheet } from '@/hooks/useCollapsibleSheet';
import { useFitRoute } from '@/hooks/useFitRoute';
import type { Activity } from '@/types';
import { ownerSplitPins, routeMarkers } from '@/utils/activityRouteMap';
import { colorSegments, pointAlongRoute } from '@/utils/colorSegments';
import { formatTimeOfDay, formatWeekdayDay } from '@/utils/dates';
import { buildActivityDeepLink } from '@/utils/deepLink';
import { activityTitle } from '@/utils/format';
import { paceColorStops } from '@/utils/paceGradient';
import { fitPadding, routeBounds } from '@/utils/routeBounds';
import {
  availableShareDesigns,
  firstSharePhoto,
  resolveShareDesign,
  type ShareDesign,
  shareExtraStats,
} from '@/utils/shareDesigns';

/** Slow to fast along the route line: blue, then yellow, then the brand orange. */
const PACE_COLORS = [Palette.blue.b4, Palette.yellow.y3, Palette.orange.o3];

/** A saved run may be named long after it ended; the first GPS fix is when it began. */
function shareDateLabel(activity: Activity): string {
  const startedAt = activity.stream?.startedAt ?? activity.createdAt;
  return `${formatWeekdayDay(startedAt)} ${formatTimeOfDay(startedAt)}`;
}

export default function ActivitySummaryScreen() {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const cameraRef = useRef<CameraRef>(null);
  const detail = useActivity();
  const {
    activity,
    coordinates,
    territory,
    isEditingName,
    editedName,
    setEditedName,
    svgRef,
    handleStartEditName,
    handleSaveName,
    handleShare,
    goBack,
    isOwner,
  } = detail;
  const paceStops = paceColorStops(activity?.stream, PACE_COLORS);
  const router = useRouter();
  const paceSegments = paceStops ? colorSegments(coordinates, paceStops) : null;
  const splitPins = ownerSplitPins(activity?.splits, coordinates, isOwner);
  const insets = useSafeAreaInsets();

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareChoice, setShareChoice] = useState<ShareDesign>('route');
  const sheet = useCollapsibleSheet();
  const { expanded: sheetExpanded, setExpanded, setBodyHeight, setHeaderHeight } = sheet;
  // Framing the route before the map has loaded does nothing, so wait for it.
  const [mapReady, setMapReady] = useState(false);
  // While the athlete scrubs the pace chart, the map marks that moment on the route.
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  useFitRoute(cameraRef, coordinates, territory, sheet.visibleHeight, undefined, mapReady);
  // Framed from the first frame: the map otherwise opens centred on the route's middle, behind the sheet.
  // The padding is read once, when the map mounts; the sheet's later moves must not rebuild it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the route, not the sheet
  const initialBounds = useMemo(() => {
    const bounds = routeBounds(territory?.length ? [...coordinates, ...territory] : coordinates);
    return bounds
      ? { bounds, padding: fitPadding({ sheetHeight: sheet.visibleHeight }) }
      : undefined;
  }, [coordinates, territory]);

  const scrubMetres = activity?.stream?.d?.[scrubIndex ?? -1];
  const scrubCursor = scrubMetres === undefined ? null : pointAlongRoute(coordinates, scrubMetres);

  const markers: MapMarker[] = routeMarkers(coordinates, scrubCursor, theme.brand);

  if (!activity) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.loadingContainer}>
            <ThemedText type="small">Loading activity...</ThemedText>
          </ThemedView>
          {/* An id that never resolves (a stale link, a deleted run) would otherwise trap the user here. */}
          <Tappable
            style={[
              styles.backButton,
              { top: insets.top + Spacing.two },
              theme.shadows.raised,
              { backgroundColor: theme.backgroundElement },
            ]}
            hitSlop={12}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const sharePhoto = firstSharePhoto(activity.images);
  const shareDesigns = availableShareDesigns({
    photoUri: sharePhoto,
    splitCount: activity.splits?.length ?? 0,
  });
  const shareDesign = resolveShareDesign(shareChoice, shareDesigns);
  const shareCard = {
    coordinates,
    territory: activity.territory,
    territoryArea: activity.territoryArea,
    distance: activity.distance,
    duration: activity.duration,
    activityType: activity.activityType,
    photoUri: sharePhoto,
    extraStats: shareExtraStats(activity, unitSystem),
    splits: activity.splits,
    title: activityTitle(activity),
    dateLabel: shareDateLabel(activity),
  };
  const icon = getSportIcon(activity.activityType);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {coordinates.length > 0 ? (
          <MapRoute
            cameraRef={cameraRef}
            coordinates={coordinates}
            territoryPolygons={territory ? [territory] : []}
            territoryColor={theme.brand.primary}
            territoryOpacity={0.2}
            markers={markers}
            paceSegments={paceSegments ?? undefined}
            splitMarkers={splitPins}
            onMapReady={() => setMapReady(true)}
            initialBounds={initialBounds}
            initialZoom={14}
            showUserLocation={false}
            dark={theme.isDark}
          />
        ) : (
          // The stats sheet overlays the bottom of this view; centre in the band above it.
          <ThemedView
            type="background"
            style={[styles.noMap, { paddingBottom: sheet.visibleHeight }]}
          >
            <Ionicons name={icon} size={40} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {activity.isManual
                ? 'Entered by hand, so there is no route'
                : 'No route was recorded'}
            </ThemedText>
          </ThemedView>
        )}

        <Tappable
          onPress={goBack}
          style={[
            styles.backButton,
            { top: insets.top + Spacing.two },
            theme.shadows.raised,
            { backgroundColor: theme.backgroundElement },
          ]}
          hitSlop={12}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={IconSize.action} color={theme.text} />
        </Tappable>

        {paceStops && (
          <View style={[styles.paceKey, { top: insets.top + Spacing.three }]}>
            <MapLegend
              items={[
                { label: 'Slower', color: PACE_COLORS[0] as string },
                { label: 'Faster', color: PACE_COLORS[2] as string },
              ]}
            />
          </View>
        )}

        <Animated.View
          style={[
            styles.statsOverlay,
            theme.shadows.sheet,
            sheet.animatedStyle,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <GestureDetector gesture={sheet.pan}>
            <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
              <Tappable
                onPress={() => setExpanded(!sheetExpanded)}
                activeOpacity={0.7}
                // 20dp-tall row extended to the 48dp floor for the expand gesture.
                hitSlop={{ top: 14, bottom: 14, left: 40, right: 40 }}
                accessibilityRole="button"
                accessibilityLabel={sheetExpanded ? 'Minimize details' : 'Expand details'}
                style={styles.handleRow}
              >
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
              </Tappable>
              <View style={styles.sheetHeader}>
                <ActivityAthleteRow activity={activity} isOwner={isOwner} />
                <ActivityTitleBlock
                  activity={activity}
                  isOwner={isOwner}
                  isEditingName={isEditingName}
                  editedName={editedName}
                  onChangeName={setEditedName}
                  onSaveName={handleSaveName}
                  onStartEditName={handleStartEditName}
                />

                {!sheetExpanded && (
                  <ActivitySummaryLine
                    activity={activity}
                    isOwner={isOwner}
                    unitSystem={unitSystem}
                    onPress={() => setExpanded(true)}
                  />
                )}
              </View>
            </View>
          </GestureDetector>

          {sheetExpanded && (
            <ActivitySheetBody
              activity={activity}
              detail={detail}
              onOpenComments={() => setCommentsOpen(true)}
              onShare={() => setShareOpen(true)}
              onFlyover={() => router.push(`/flyover?activityId=${activity.id}`)}
              onScrubChange={setScrubIndex}
              onContentHeight={setBodyHeight}
            />
          )}
        </Animated.View>
      </SafeAreaView>

      <CommentsSheet
        visible={commentsOpen}
        activityId={activity.id}
        onClose={() => setCommentsOpen(false)}
      />

      <ShareDesignSheet
        visible={shareOpen}
        designs={shareDesigns}
        selected={shareDesign}
        onSelect={setShareChoice}
        onShare={handleShare}
        onSave={detail.handleDownload}
        onCopy={detail.handleCopy}
        onClose={() => setShareOpen(false)}
        qrLink={buildActivityDeepLink(activity.id)}
        card={shareCard}
      />

      <View style={styles.shareImageContainer} pointerEvents="none">
        <ShareRouteImage ref={svgRef} {...shareCard} design={shareDesign} height={1920} />
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
  paceKey: { position: 'absolute', right: Spacing.three },
  backButton: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    // 48dp is the Android touch-target minimum.
    width: Touch.target,
    height: Touch.target,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
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
    borderRadius: BorderRadius.xxs,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  shareImageContainer: {
    position: 'absolute',
    top: -10000,
    left: 0,
    width: 1080,
    height: 1920,
  },
});
