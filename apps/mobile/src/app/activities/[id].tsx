import { Input } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { getActiveConfig } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityActionRow } from '@/components/activity-action-row';
import { ActivityChartPager } from '@/components/activity-chart-pager';
import { ActivityDescription } from '@/components/activity-description';
import { ActivityPrivateDetails } from '@/components/activity-private-details';
import { ActivityProofCard } from '@/components/activity-proof-card';
import { ActivitySocialRow } from '@/components/activity-social-row';
import { BestEfforts } from '@/components/best-efforts';
import { AppButton } from '@/components/button';
import { ChainSyncRetry } from '@/components/chain-sync-retry';
import { CommentsSheet } from '@/components/comments-sheet';
import { GearPicker } from '@/components/gear-picker';
import { RewardHoldBanner } from '@/components/reward-hold-banner';
import { HeartRateZones } from '@/components/heart-rate-zones';
import { IconBadge } from '@/components/icon-badge';
import { LapsList } from '@/components/laps-list';
import { MapLegend } from '@/components/map-legend';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { PhotoGallery } from '@/components/photo-gallery';
import { PhotoPicker } from '@/components/photo-picker';
import { PhotoViewer } from '@/components/photo-viewer';
import { ShareDesignSheet } from '@/components/share-design-sheet';
import { ShareRouteImage } from '@/components/share-route-image';
import { SplitsList } from '@/components/splits-list';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon, getSportLabel } from '@/constants/activity';
import { getChainMode } from '@/constants/config';
import { Palette } from '@/constants/palette';
import { BorderRadius, type Brand, IconSize, Spacing, Touch, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivity } from '@/hooks/useActivity';
import { useActivityInsights } from '@/hooks/useActivityInsights';
import { useChainRetry } from '@/hooks/useChainRetry';
import { useCollapsibleSheet } from '@/hooks/useCollapsibleSheet';
import { useFitRoute } from '@/hooks/useFitRoute';
import { useGearStore } from '@/stores/gearStore';
import { useProfileStore } from '@/stores/profileStore';
import { useRouteStore } from '@/stores/routeStore';
import type { Activity } from '@/types';
import { sportStatSet } from '@/utils/activityStats';
import { estimateCalories } from '@/utils/calories';
import { explorerTxUrl } from '@/utils/chainProof';
import { colorSegments, pointAlongRoute } from '@/utils/colorSegments';
import { formatTimeOfDay, formatWeekdayDay } from '@/utils/dates';
import { buildActivityDeepLink } from '@/utils/deepLink';
import { elevationWorthShowing } from '@/utils/elevationWorthShowing';
import { formatArea, formatDistance, formatDurationLong, formatPaceOrSpeed } from '@/utils/format';
import { gearForSport } from '@/utils/gearMileage';
import { haptics } from '@/utils/haptics';
import type { LngLatPair } from '@/utils/mapData';
import { paceColorStops } from '@/utils/paceGradient';
import { RECORD_LABEL } from '@/utils/personalRecords';
import { fitPadding, routeBounds } from '@/utils/routeBounds';
import {
  availableShareDesigns,
  firstSharePhoto,
  resolveShareDesign,
  type ShareDesign,
} from '@/utils/shareDesigns';
import { similarRunsText } from '@/utils/similarRuns';
import { type SplitMarker, splitMarkers } from '@/utils/splitMarkers';
import { Toast } from '@/utils/toast';

/** Slow to fast along the route line: blue, then yellow, then the brand orange. */
const PACE_COLORS = [Palette.blue.b4, Palette.yellow.y3, Palette.orange.o3];

function ownerSplitPins(
  splits: Activity['splits'],
  coordinates: readonly LngLatPair[],
  isOwner: boolean
): SplitMarker[] | undefined {
  if (!isOwner || !splits || splits.length < 2) return undefined;
  const total = splits.reduce((sum, s) => sum + s.distance, 0);
  return splitMarkers(coordinates, splits[0]?.distance ?? 0, total);
}

function routeMarkers(
  coordinates: readonly LngLatPair[],
  scrubCursor: LngLatPair | null,
  brand: Pick<typeof Brand, 'success' | 'danger' | 'primary'>
): MapMarker[] {
  const list: MapMarker[] = [];
  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (first && last) {
    list.push({
      id: 'start',
      coordinate: first,
      color: brand.success,
      icon: 'play',
    });
    list.push({
      id: 'end',
      coordinate: last,
      color: brand.danger,
      icon: 'stop',
    });
  }
  if (scrubCursor) {
    list.push({ id: 'scrub', coordinate: scrubCursor, color: brand.primary });
  }
  return list;
}

function SheetStat({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="headline" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

export default function ActivitySummaryScreen() {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const allGear = useGearStore((s) => s.gear);
  const ownWeightKg = useProfileStore((s) => s.settings.weightKg);
  const cameraRef = useRef<CameraRef>(null);
  const {
    activity,
    coordinates,
    territory,
    isEditingName,
    editedName,
    setEditedName,
    elevationData,
    svgRef,
    handleDelete,
    handleStartEditName,
    handleSaveName,
    savePhotos,
    setGear,
    descriptionDraft,
    setDescriptionDraft,
    handleStartEditDescription,
    handleSaveDescription,
    handleCancelEditDescription,
    handleShare,
    handleExportGpx,
    handleCopy,
    handleDownload,
    goBack,
    goHome,
    isOwner,
  } = useActivity();
  const { bestEfforts, zoneTimes, similar, heldRecords, maxHr, restingHr, hasHeartRate } =
    useActivityInsights(activity, isOwner);
  const paceStops = paceColorStops(activity?.stream, PACE_COLORS);
  const router = useRouter();
  const paceSegments = paceStops ? colorSegments(coordinates, paceStops) : null;
  // Only the owner's copy is the whole route; a shared one may have its ends cut, which would
  // shift every pin. Placed against the splits' own total so pin k matches row k of the list.
  const splitPins = ownerSplitPins(activity?.splits, coordinates, isOwner);
  const gearName = useGearStore((s) => s.gear.find((g) => g.id === activity?.gearId)?.name);
  const chainRetry = useChainRetry(activity?.id);
  // The receipt is the block explorer's copy of the proof; the hash lives there, not on this screen.
  const receipt =
    activity && getChainMode() !== 'local'
      ? explorerTxUrl(getActiveConfig().chain.blockExplorers?.default.url, activity.txHash)
      : null;
  const insets = useSafeAreaInsets();

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [viewedPhoto, setViewedPhoto] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareChoice, setShareChoice] = useState<ShareDesign>('route');
  const savedRoutes = useRouteStore((s) => s.routes);
  const routeSaved = savedRoutes.some((r) => r.polyline === activity?.polyline);
  const toggleSavedRoute = () => {
    if (!activity) return;
    const { save, remove } = useRouteStore.getState();
    const saved = savedRoutes.find((r) => r.polyline === activity.polyline);
    if (saved) {
      remove(saved.id);
      Toast.info('Removed from saved routes', 1);
      return;
    }
    save({
      name: activity.name || getSportLabel(activity.activityType),
      polyline: activity.polyline,
      distance: activity.distance,
      sport: activity.activityType,
      elevationGain: activity.elevationGain,
      duration: activity.duration,
    });
    haptics.success();
    Toast.success('Saved. Find it on the Maps tab', 1.5);
  };
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
        </SafeAreaView>
      </ThemedView>
    );
  }

  const headlineStats = sportStatSet(
    {
      activityType: activity.activityType,
      distance: activity.distance,
      duration: activity.duration,
      elevationGain: activity.elevationGain ?? elevationData?.totalAscent,
      maxElevation:
        elevationData && elevationWorthShowing(elevationData)
          ? Math.max(...elevationData.elevations)
          : undefined,
      stream: activity.stream,
      // A measured figure from the device beats an estimate.
      calories:
        activity.caloriesBurned ??
        estimateCalories({
          activityType: activity.activityType,
          distance: activity.distance,
          duration: activity.duration,
          // Only the athlete's own weight is known, so only their own activity gets an estimate.
          weightKg: isOwner ? ownWeightKg : undefined,
        }),
      heartRate: activity.heartRate,
      elapsed: activity.stream ? (activity.stream.t.at(-1) ?? 0) * 1000 : undefined,
    },
    unitSystem
  );
  const chartElevations =
    elevationData && elevationWorthShowing(elevationData) ? elevationData.elevations : undefined;
  const sharePhoto = firstSharePhoto(activity.images);
  const shareDesigns = availableShareDesigns(sharePhoto);
  const shareDesign = resolveShareDesign(shareChoice, shareDesigns);
  const shareCard = {
    coordinates,
    territory: activity.territory,
    territoryArea: activity.territoryArea,
    distance: activity.distance,
    duration: activity.duration,
    activityType: activity.activityType,
    photoUri: sharePhoto,
  };
  const gearOptions = gearForSport(allGear, activity.activityType);
  const icon = getSportIcon(activity.activityType);
  // A saved run may be named long after it ended; the first GPS fix is when it began.
  const date = new Date(activity.stream?.startedAt ?? activity.createdAt);
  const dateStr = formatWeekdayDay(date);
  const timeStr = formatTimeOfDay(date);

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
                          inputStyle={styles.nameInput}
                        />
                      ) : (
                        <Tappable
                          onPress={handleStartEditName}
                          disabled={!isOwner}
                          activeOpacity={0.7}
                          // The name row renders 20dp tall; +14 top/bottom reaches the 48dp floor.
                          hitSlop={{ top: 14, bottom: 14, left: 12, right: 40 }}
                          accessibilityRole={isOwner ? 'button' : 'header'}
                          accessibilityLabel={
                            isOwner ? `${activity.name}. Edit the name` : activity.name
                          }
                        >
                          <ThemedText type="headline">{activity.name}</ThemedText>
                        </Tappable>
                      )}
                      <ThemedText type="small" themeColor="textSecondary">
                        {dateStr} at {timeStr}
                        {gearName ? ` · ${gearName}` : ''}
                      </ThemedText>
                      {isOwner && chainRetry.canRetry && (
                        <ChainSyncRetry busy={chainRetry.busy} onRetry={chainRetry.retry} />
                      )}
                    </ThemedView>
                  </ThemedView>
                </ThemedView>

                {!sheetExpanded && (
                  <Tappable
                    onPress={() => setExpanded(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Show the activity details"
                  >
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {formatDistance(activity.distance, unitSystem)} ·{' '}
                      {formatDurationLong(activity.duration)} ·{' '}
                      {formatPaceOrSpeed(
                        activity.activityType,
                        activity.distance,
                        activity.duration,
                        unitSystem
                      )}
                    </ThemedText>
                  </Tappable>
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
                {headlineStats.map((stat) => (
                  <SheetStat key={stat.label} label={stat.label} value={stat.value} />
                ))}
                {activity.territory ? (
                  <SheetStat
                    label="Territory"
                    value={formatArea(activity.territoryArea, unitSystem)}
                  />
                ) : null}
              </ThemedView>

              {receipt && (
                <Tappable
                  style={styles.txRow}
                  onPress={() =>
                    Linking.openURL(receipt).catch(() => {
                      Toast.fail('Could not open the receipt', 1);
                    })
                  }
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  accessibilityLabel="Verified. View the receipt for this activity"
                  // The label row renders ~17dp tall; +16 vertical reaches the 48dp floor.
                  hitSlop={{ top: 16, bottom: 16 }}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={IconSize.badge}
                    color={theme.brand.primary}
                  />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.receiptLabel}>
                    Verified · View receipt
                  </ThemedText>
                </Tappable>
              )}

              <ActivitySocialRow activityId={activity.id} onOpen={() => setCommentsOpen(true)} />

              {bestEfforts.length > 0 && (
                <BestEfforts efforts={bestEfforts} unitSystem={unitSystem} />
              )}

              {activity.laps && activity.laps.length > 0 && (
                <LapsList
                  laps={activity.laps}
                  unitSystem={unitSystem}
                  activityType={activity.activityType}
                />
              )}

              {heldRecords.length > 0 ? (
                <ThemedView style={styles.recordRow}>
                  {heldRecords.map((kind) => (
                    <ThemedView
                      key={kind}
                      style={[
                        styles.recordChip,
                        { backgroundColor: tint(theme.brand.primary, 0.12) },
                      ]}
                    >
                      <Ionicons name="trophy-outline" size={14} color={theme.accentText} />
                      <ThemedText type="small" style={{ color: theme.accentText }}>
                        {RECORD_LABEL[kind]}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              ) : null}

              {similar ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {similarRunsText(similar)}
                </ThemedText>
              ) : null}

              <ActivityChartPager
                stream={activity.stream}
                elevations={chartElevations}
                activityType={activity.activityType}
                unitSystem={unitSystem}
                onScrubChange={setScrubIndex}
              />

              {zoneTimes.length > 0 && maxHr ? (
                <HeartRateZones zones={zoneTimes} maxHr={maxHr} restingHr={restingHr} />
              ) : null}

              {isOwner && hasHeartRate && !maxHr ? (
                <Tappable
                  onPress={() => router.push('/body')}
                  accessibilityRole="link"
                  accessibilityLabel="Add your birthday or max heart rate on the Body screen to see heart-rate zones"
                  hitSlop={8}
                >
                  <ThemedText type="small" style={{ color: theme.accentText }}>
                    Add your birthday or max heart rate to see heart-rate zones
                  </ThemedText>
                </Tappable>
              ) : null}

              {activity.splits && activity.splits.length > 1 && (
                <SplitsList
                  splits={activity.splits}
                  unitSystem={unitSystem}
                  activityType={activity.activityType}
                />
              )}

              {isOwner && gearOptions.length > 0 && (
                <ThemedView style={styles.photoSection}>
                  <ThemedText type="eyebrow" themeColor="textSecondary">
                    {activity.activityType === 'ride' ? 'Bike' : 'Shoes'}
                  </ThemedText>
                  <GearPicker
                    options={gearOptions}
                    selected={activity.gearId ?? null}
                    onSelect={setGear}
                  />
                </ThemedView>
              )}

              {isOwner ? (
                <ThemedView style={styles.photoSection}>
                  <PhotoPicker
                    photos={activity.images ?? []}
                    onPhotosChange={savePhotos}
                    onOpen={setViewedPhoto}
                  />
                  <PhotoViewer
                    photos={activity.images ?? []}
                    startIndex={viewedPhoto}
                    onClose={() => setViewedPhoto(null)}
                  />
                </ThemedView>
              ) : (
                activity.images &&
                activity.images.length > 0 && (
                  <ThemedView style={styles.photoSection}>
                    <PhotoGallery photos={activity.images} />
                  </ThemedView>
                )
              )}

              <ActivityDescription
                editable={isOwner}
                description={activity.description}
                draft={descriptionDraft}
                onChangeDraft={setDescriptionDraft}
                onStartEdit={handleStartEditDescription}
                onCancel={handleCancelEditDescription}
                onSave={handleSaveDescription}
              />

              {isOwner && <RewardHoldBanner activity={activity} />}
              {isOwner && <ActivityProofCard activity={activity} />}

              {isOwner && <ActivityPrivateDetails activity={activity} />}

              <ThemedView style={styles.actions}>
                <AppButton onPress={goHome} style={styles.doneButton}>
                  Done
                </AppButton>

                <ActivityActionRow
                  hasRoute={coordinates.length > 1}
                  routeSaved={routeSaved}
                  isOwner={isOwner}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                  onShare={() => setShareOpen(true)}
                  onExportGpx={handleExportGpx}
                  onToggleSavedRoute={toggleSavedRoute}
                  onDelete={handleDelete}
                />
              </ThemedView>
            </ScrollView>
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
        onSave={handleDownload}
        onClose={() => setShareOpen(false)}
        qrLink={buildActivityDeepLink(activity.id)}
        card={shareCard}
      />

      <View style={styles.shareImageContainer} pointerEvents="none">
        <ShareRouteImage
          ref={svgRef}
          design={shareDesign}
          photoUri={sharePhoto}
          coordinates={coordinates}
          territory={activity.territory}
          territoryArea={activity.territoryArea}
          distance={activity.distance}
          duration={activity.duration}
          activityType={activity.activityType}
          height={1920}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  recordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  recordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
  },
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
    ...textStyle(TypeScale.sectionTitle),
    borderBottomWidth: 1,
    paddingBottom: Spacing.half,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  stat: {
    width: '50%',
    // Label over value, left-aligned, to match the feed card.
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.two,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // flex 1 so the label takes the row's remaining width: inside the nested scroll view it
  // otherwise measures a two-line box and wraps "receipt" even with space to spare.
  receiptLabel: { flex: 1 },
  actions: {
    gap: Spacing.three,
  },
  doneButton: {
    alignSelf: 'stretch',
    borderRadius: BorderRadius.full,
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
});
