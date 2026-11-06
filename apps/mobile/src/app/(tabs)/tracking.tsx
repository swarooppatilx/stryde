import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, Share, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FollowRouteBanner } from '@/components/follow-route-banner';
import { LocateButton } from '@/components/locate-button';
import type { MapCamera } from '@/components/map-camera';
import { MapLayersSheet } from '@/components/map-layers-sheet';
import { type CameraMove, type MapMarker, MapRoute } from '@/components/map-route';
import { LapCompleteCard, PausedBar } from '@/components/record-banners';
import { RecordControls } from '@/components/record-controls';
import { RecordFlyout } from '@/components/record-flyout';
import { RecordIsland } from '@/components/record-island';
import { RecordLockOverlay } from '@/components/record-lock-overlay';
import { RecordMapControls } from '@/components/record-map-controls';
import { RecordPreRun } from '@/components/record-prerun';
import { RecordSheet, SheetHandle } from '@/components/record-sheet';
import { RecordStatsView } from '@/components/record-stats-view';
import { StartCountdownOverlay } from '@/components/start-countdown-overlay';
import { ThemedText } from '@/components/themed-text';
import { ZoomControls } from '@/components/zoom-controls';
import { SPORT_TYPES } from '@/constants/activity';
import { DEFAULT_CENTER, ENV } from '@/constants/config';
import { MapChrome } from '@/constants/mapChrome';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useFollowCamera, useSmoothedHeading } from '@/hooks/useFollowCamera';
import { useFollowRoute } from '@/hooks/useFollowRoute';
import { useGpsPreview } from '@/hooks/useGpsPreview';
import { useHideTabBar } from '@/hooks/useHideTabBar';
import { useLapCard } from '@/hooks/useLapCard';
import { useLocationServices } from '@/hooks/useLocationServices';
import { useNow } from '@/hooks/useNow';
import { usePreRunReadiness } from '@/hooks/usePreRunReadiness';
import type { RecoveryChoice } from '@/hooks/useRecoveredRun';
import { useStartCountdown } from '@/hooks/useStartCountdown';
import { useTrackingSession } from '@/hooks/useTrackingSession';
import { useVerticalSwipe } from '@/hooks/useVerticalSwipe';
import { useViemWallet } from '@/hooks/useViemWallet';
import { getPlatform } from '@/platform';
import { setFinishedSession } from '@/services/activityPipeline';
import { endBeacon, pushBeacon } from '@/services/arkivService';
import { confirmStart } from '@/services/startChecks';
import { territoryService } from '@/services/territoryService';
import { trackingService } from '@/services/trackingService';
import { useFollowRouteStore } from '@/stores/followRouteStore';
import { layerBadgeCount, resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useRecordUiStore } from '@/stores/recordUiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ActivityType, Ring } from '@/types';
import { Alert } from '@/utils/alert';
import { colorSegments } from '@/utils/colorSegments';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { MAX_ZOOM, MIN_ZOOM, TILT_DEGREES } from '@/utils/followCamera';
import { formatDistance, METERS_PER_MILE } from '@/utils/format';
import { describeGpsSignal } from '@/utils/gpsSignal';
import { haptics } from '@/utils/haptics';
import { livePaceStops } from '@/utils/livePace';
import type { LiveStatData } from '@/utils/liveStats';
import { logger } from '@/utils/logger';
import { isTooShort } from '@/utils/minimumRun';
import { backWhileRecording } from '@/utils/recordBack';
import { type FollowAction, type FollowState, followZoom, nextFollow } from '@/utils/recordCamera';
import { stashRecordedRun } from '@/utils/recordedRunHandoff';
import { recordedRunParams } from '@/utils/recordedRunParams';
import { flyoutRows } from '@/utils/recordIsland';
import { recoverAction } from '@/utils/recoverAction';
import { splitMarkers as splitPins } from '@/utils/splitMarkers';
import { Toast } from '@/utils/toast';

const ZOOM_RANGE = { min: MIN_ZOOM, max: MAX_ZOOM };
const BEACON_INTERVAL_MS = 30_000;
/** Slow to fast along the live trail, as on a saved run's map. */
const PACE_COLORS = [Palette.blue.b4, Palette.yellow.y3, Palette.orange.o3];

export default function TrackingScreen() {
  const { snapshot, restoreSettled, start, pause, resume, finish, lap } = useTrackingSession();
  const {
    status,
    distance,
    duration,
    lastFix: location,
    route: routeCoordinates,
    polygon: trackedPolygon,
    startLocation,
    autoPaused,
  } = snapshot;
  const isTracking = status === 'tracking';
  const isPaused = status === 'paused';
  const isSessionActive = status !== 'idle';
  const routePointCount = routeCoordinates.length;

  const [pickedType, setActivityType] = useState<ActivityType>('run');
  // A run picked back up after a restart shows the sport it was started with.
  const activityType = snapshot.activityType ?? pickedType;
  const activeType = SPORT_TYPES.find((t) => t.type === activityType);
  const activityLabel = activeType?.label ?? activityType;

  // The session and the preview only emit when something changes, so age the GPS fix on a clock.
  const previewFix = useGpsPreview(!isSessionActive);
  // Always ticking: while no fix has arrived yet, the clock is what lets a slow first fix say so.
  const now = useNow(isSessionActive ? 1000 : 2000, true);
  // The wait for a first fix starts when the screen does; a slow one then says what to check.
  const waitingSince = useRef(Date.now());
  const { servicesOn, permitted } = useLocationServices(true);
  const readinessRows = usePreRunReadiness(!isSessionActive);
  const signal = describeGpsSignal(isSessionActive ? location : previewFix, now, {
    waitingSince: waitingSince.current,
    servicesOn,
    // An active recording already has its permission; only the wait before Start can lack it.
    permitted: isSessionActive || permitted,
  });

  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const unitSystem = useUnitSystem();
  const [locked, setLocked] = useState(false);
  // The big-number stats view; it opens once when a run starts and the athlete can shrink it.
  const [fullStats, setFullStats] = useState(false);
  // Whether the map follows the athlete, and north-up or heading-up. Dragging the map away stops it;
  // the locate button brings it back, and swaps the mode when it is already following.
  const savedMode = useMapPrefsStore((s) => s.recordFollowMode);
  const setSavedMode = useMapPrefsStore((s) => s.setRecordFollowMode);
  const [follow, setFollow] = useState<FollowState>({ following: true, mode: savedMode });
  const cameraRef = useRef<MapCamera>(null);
  const [mapHeight, setMapHeight] = useState(0);
  const [tilted, setTilted] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [islandHeight, setIslandHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const trackLaps = useRecordUiStore((s) => s.trackLaps);
  const setTrackLaps = useRecordUiStore((s) => s.setTrackLaps);
  const mapStyle = useMapPrefsStore((s) => s.style);
  const showPoi = useMapPrefsStore((s) => s.showPoi);
  const showBikeLanes = useMapPrefsStore((s) => s.showBikeLanes);
  const mapType = useMapPrefsStore((s) => s.mapType);
  const terrain3d = useMapPrefsStore((s) => s.terrain3d);
  const layersBadge = useMapPrefsStore((s) => layerBadgeCount(s));
  const onMapLayout = (event: LayoutChangeEvent) => setMapHeight(event.nativeEvent.layout.height);
  const steer = (action: FollowAction) => {
    const next = nextFollow(follow, action);
    setFollow(next);
    if (next.mode !== follow.mode) setSavedMode(next.mode);
  };
  const fix = isSessionActive ? location : previewFix;
  // A saved route picked with "Use this route": drawn under the live track, with progress and alerts.
  const followedRoute = useFollowRouteStore((s) => s.route);
  const stopFollowing = useFollowRouteStore((s) => s.stop);
  const followView = useFollowRoute(fix, isTracking);
  const heading = useSmoothedHeading(fix);
  const { onCameraMove, zoomBy } = useFollowCamera({
    cameraRef,
    fix,
    heading,
    follow,
    active: isSessionActive,
    mapHeight,
    initialZoom: followZoom('idle'),
    // Once recording the map runs under the sheet, so the puck is kept above it.
    bottomInset: isSessionActive && !fullStats ? sheetHeight : 0,
    tilted,
    onUserMoved: () => steer('dragged'),
  });
  const optionsSwipe = useVerticalSwipe((direction) => setFlyoutOpen(direction === 'up'), {
    distance: 15,
    velocity: 400,
  });
  const handleCameraMove = (move: CameraMove) => {
    setBearing(Math.round(move.bearing));
    onCameraMove(move);
  };
  const toggleTilt = () => {
    const next = !tilted;
    setTilted(next);
    // Following re-aims the camera itself; otherwise only the lean changes.
    if (!follow.following)
      cameraRef.current?.easeTo({ pitch: next ? TILT_DEGREES : 0, duration: 500 });
  };
  const turnNorth = () => {
    if (follow.following && follow.mode === 'heading') steer('locate');
    else cameraRef.current?.easeTo({ bearing: 0, duration: 500 });
  };
  const puck = useMemo(
    () =>
      fix
        ? {
            coordinate: [fix.longitude, fix.latitude] as [number, number],
            accuracy: fix.accuracy,
            heading,
          }
        : null,
    [fix, heading]
  );
  // Auto-pause is silent otherwise: a phone in a pocket should say when it stops or restarts.
  const wasAutoPaused = useRef(false);
  useEffect(() => {
    if (autoPaused === wasAutoPaused.current) return;
    wasAutoPaused.current = autoPaused;
    if (autoPaused) haptics.warning();
    else if (isTracking) haptics.tap();
  }, [autoPaused, isTracking]);
  // A finished or discarded recording leaves nothing to lock.
  useEffect(() => {
    if (!isSessionActive) {
      setLocked(false);
      setFullStats(false);
      setFlyoutOpen(false);
      setTilted(false);
      setFollow((current) => nextFollow(current, 'reset'));
    }
  }, [isSessionActive]);

  // Hide the tab bar during a session so it takes no space and cannot be tapped by accident.
  useHideTabBar(isSessionActive);

  const showStartFailure = (message: string | undefined) =>
    Alert.alert('Location Error', message ?? 'Unable to access your location.', [{ text: 'OK' }]);

  // Waiting for the first GPS answer can take seconds; the button says so instead of looking dead.
  const [starting, setStarting] = useState(false);
  const handleStart = async (type: ActivityType) => {
    setStarting(true);
    try {
      const result = await start(type, SPORT_TYPES.find((t) => t.type === type)?.label ?? type);
      // 'permission': the permission prompt already explained itself; 'busy': a double tap.
      if (!result.ok && result.reason === 'gps') showStartFailure(result.message);
      if (result.ok) setFullStats(true);
    } finally {
      setStarting(false);
    }
  };

  const countdown = useStartCountdown(handleStart);

  // Live beacon: a 10-minute Arkiv entity the server patches every BEACON_INTERVAL_MS, so
  // friends can follow the run and it vanishes after.
  const liveBeacon = useSettingsStore((s) => s.liveBeacon);
  const runIdRef = useRef('');
  const [beaconLive, setBeaconLive] = useState(false);
  const beaconInput = useRef({ fix: location, distance, duration });
  beaconInput.current = { fix: location, distance, duration };
  const { address: athlete } = useViemWallet();
  useEffect(() => {
    if (!isSessionActive || !liveBeacon || !athlete) return;
    if (!runIdRef.current) {
      runIdRef.current = getPlatform()
        .ids.next()
        .replace(/[^A-Za-z0-9_-]/g, '')
        .padEnd(8, '0')
        .slice(0, 32);
    }
    const push = () => {
      const { fix: last, distance: distanceM, duration: durationMs } = beaconInput.current;
      if (!last) return;
      const durationSec = durationMs / 1000;
      pushBeacon({
        runId: runIdRef.current,
        athlete,
        latitude: last.latitude,
        longitude: last.longitude,
        paceSecPerKm: distanceM > 50 ? Math.round(durationSec / (distanceM / 1000)) : 0,
      })
        .then(() => setBeaconLive(true))
        .catch((error) => {
          setBeaconLive(false);
          logger.warn('[Record] Beacon update failed', error);
        });
    };
    push();
    const interval = setInterval(push, BEACON_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSessionActive, liveBeacon, athlete]);

  const endLiveBeacon = () => {
    if (runIdRef.current && beaconLive) endBeacon(runIdRef.current).catch(() => undefined);
    runIdRef.current = '';
    setBeaconLive(false);
  };

  const shareLiveBeacon = () => {
    Share.share({
      message: `Follow my ${activityLabel.toLowerCase()} live on Stryde: ${ENV.API_URL}/api/live/${runIdRef.current}`,
    }).catch(() => undefined);
  };

  const captureFinishedTrack = () =>
    setFinishedSession(
      trackingService
        .getLocations()
        .map((l) => ({ latitude: l.latitude, longitude: l.longitude, timestamp: l.timestamp }))
    );

  const handleResume = async () => {
    const result = await resume();
    if (!result.ok && result.reason === 'gps') showStartFailure(result.message);
  };

  // Pressing Lap shows how that lap went for a few seconds.
  const lastLap = snapshot.lastLap;
  const lapCard = useLapCard(snapshot.lapCount, lastLap);

  const wasPaused = useRef(false);
  useEffect(() => {
    if (isTracking && wasPaused.current) Toast.show('Recording resumed', 2);
    wasPaused.current = isPaused;
  }, [isTracking, isPaused]);

  // A second tap while the first is still closing the run would find nothing to finish.
  const finishing = useRef(false);
  const finishActivity = async () => {
    if (finishing.current) return;
    if (isTooShort(activityType, distance)) {
      // Ask before anything is torn down: finishing a run this short throws it away.
      Alert.alert(
        // Says how far the athlete got.
        'Not moving yet?',
        `You have moved ${formatDistance(distance, unitSystem)}, which is too short to save. Please continue or start over.`,
        [
          { text: 'Resume', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              finishing.current = true;
              try {
                await finish();
              } finally {
                finishing.current = false;
              }
            },
          },
        ]
      );
      return;
    }
    finishing.current = true;
    try {
      captureFinishedTrack();
      endLiveBeacon();
      const result = await finish();
      if (!result.ok) {
        Alert.alert('Could not finish', result.error);
        return;
      }
      router.push({
        pathname: '/create-activity',
        params: { run: stashRecordedRun(recordedRunParams(result.summary, activityType)) },
      });
    } catch (error) {
      logger.error('[Record] Finish failed', error);
      Alert.alert('Could not finish', 'Please try again.');
    } finally {
      finishing.current = false;
    }
  };

  // Throwing a run away cannot be undone, so ask first, whatever its length.
  const confirmDiscardRun = () => {
    if (finishing.current) return;
    confirmDestructive({
      title: 'Discard this activity?',
      message: 'What you have recorded so far will be deleted.',
      confirmLabel: 'Discard',
      cancelLabel: 'Resume',
      onConfirm: async () => {
        finishing.current = true;
        try {
          endLiveBeacon();
          await finish();
        } finally {
          finishing.current = false;
        }
      },
    });
  };

  // Save or Discard chosen on the recovery prompt: once the run is back in the session, take the
  // same path as pressing Finish or Discard here.
  const { recover } = useLocalSearchParams<{ recover?: RecoveryChoice }>();
  const recoverHandled = useRef(false);
  const action = recoverAction(recover, status, restoreSettled);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per prompt answer, with the handlers of that moment
  useEffect(() => {
    if (action === 'none') recoverHandled.current = false;
    if (action === 'none' || action === 'wait' || recoverHandled.current) return;
    recoverHandled.current = true;
    router.setParams({ recover: undefined });
    if (action === 'save') void finishActivity();
    else if (action === 'discard') confirmDiscardRun();
  }, [action]);
  // An answer left over from a visit that never used it must not meet a later run.
  useFocusEffect(
    useCallback(
      () => () => {
        router.setParams({ recover: undefined });
      },
      [router]
    )
  );

  // The handler below outlives renders, so it reads the latest finish through a ref.
  const finishRef = useRef(finishActivity);
  finishRef.current = finishActivity;
  // Back on a live recording asks instead of leaving: the tab bar is hidden then, so Back was the way out.
  useBackHandler(() => {
    if (backWhileRecording({ locked, finishing: finishing.current }) === 'ask') {
      Alert.alert('Leave the recording?', 'It keeps recording until you finish it.', [
        { text: 'Resume', style: 'cancel' },
        { text: 'Finish and save', onPress: () => void finishRef.current() },
      ]);
    }
  }, isSessionActive);

  // The camera follows from here on; this is only where the map is first drawn.
  const [initialCenter] = useState<[number, number]>(() =>
    fix ? [fix.longitude, fix.latitude] : DEFAULT_CENTER
  );
  const territoryArea = trackedPolygon ? territoryService.getPolygonArea(trackedPolygon) : null;
  const { recent, lapCount, splits, elevationGain, laps, lapStart } = snapshot;
  const fixAgeMs = location ? Math.max(0, now - location.timestamp) : null;
  const altitude = location?.altitude ?? null;
  const liveData = useMemo<LiveStatData>(
    () => ({
      distance,
      duration,
      recent,
      territoryArea,
      elevationGain,
      lapCount,
      lastLap,
      laps,
      splits,
      fixAgeMs,
      altitude,
      currentLap: {
        distance: Math.max(0, distance - lapStart.distance),
        duration: Math.max(0, duration - lapStart.duration),
      },
    }),
    [
      distance,
      duration,
      recent,
      territoryArea,
      elevationGain,
      lapCount,
      lastLap,
      laps,
      splits,
      fixAgeMs,
      altitude,
      lapStart,
    ]
  );

  const markers: MapMarker[] = useMemo(() => {
    const next: MapMarker[] = [];
    if (startLocation && (isTracking || duration > 0)) {
      next.push({ id: 'start', coordinate: startLocation, color: Brand.success, icon: 'play' });
    }
    return next;
  }, [startLocation, isTracking, duration]);

  const lastRoutePoint = routeCoordinates.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a fix replaces the route array; its length and last point say whether the line changed
  const paceSegments = useMemo(() => {
    const stops = livePaceStops(splits, distance, PACE_COLORS);
    return stops ? colorSegments(routeCoordinates, stops) : undefined;
  }, [splits, distance, routePointCount, lastRoutePoint?.[0], lastRoutePoint?.[1]]);
  const splitSize = unitSystem === 'imperial' ? METERS_PER_MILE : 1000;
  // biome-ignore lint/correctness/useExhaustiveDependencies: pins only move when a split finishes or the line is cut differently
  const splitMarkers = useMemo(
    () => splitPins(routeCoordinates, splitSize, distance),
    [splitSize, splits.length, routePointCount]
  );

  const territoryPolygons = useMemo<Ring[]>(
    () => (trackedPolygon ? [trackedPolygon] : []),
    [trackedPolygon]
  );

  // One map element for the whole screen, so starting a run never rebuilds the map under the athlete.
  const mapView = (
    <View style={isSessionActive ? styles.mapFull : styles.map} onLayout={onMapLayout}>
      <MapRoute
        coordinates={routeCoordinates.length > 1 ? routeCoordinates : undefined}
        territoryPolygons={territoryPolygons}
        territoryColor={Brand.success}
        territoryOpacity={0.22}
        markers={markers}
        position={puck}
        paceSegments={paceSegments}
        splitMarkers={splitMarkers}
        initialCenter={initialCenter}
        initialZoom={followZoom('idle')}
        zoomRange={ZOOM_RANGE}
        cameraRef={cameraRef}
        onCameraMove={handleCameraMove}
        dark={resolveMapStyle(mapStyle, theme.isDark) === 'dark'}
        poi={showPoi}
        bikeLanes={showBikeLanes}
        mapType={mapType}
        terrain3d={terrain3d}
        guideLine={followedRoute?.line}
      />
      {followView && (
        <FollowRouteBanner
          view={followView}
          onStop={stopFollowing}
          // The map buttons stand at the right edge before and during a run; keep clear of them.
          style={{
            top: isSessionActive
              ? insets.top + Spacing.three + islandHeight + Spacing.two
              : insets.top + Spacing.three + 64,
            right: Spacing.three + MapChrome.fab + Spacing.two,
          }}
        />
      )}
      {fix && !isSessionActive && (
        <LocateButton
          follow={follow}
          onPress={() => steer('locate')}
          style={{ top: insets.top + Spacing.three, backgroundColor: theme.backgroundElement }}
          iconColor={theme.text}
        />
      )}
      {fix && !locked && !isSessionActive && (
        <ZoomControls
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          style={{ bottom: Spacing.three, backgroundColor: theme.backgroundElement }}
          iconColor={theme.text}
          dividerColor={theme.border}
        />
      )}
    </View>
  );

  if (!isSessionActive) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {mapView}
        <RecordPreRun
          signal={signal}
          starting={starting}
          onOpenSettings={() => router.push('/recording-settings')}
          onOpenLocationSettings={() => void getPlatform().location.openSettings()}
          readiness={readinessRows}
          onReadinessAction={(kind) => {
            const { location, readiness } = getPlatform();
            void (kind === 'openLocationSettings'
              ? location.openSettings()
              : readiness.openAppSettings());
          }}
          onStart={async (type) => {
            setActivityType(type);
            // Ask first: a dialog in the middle of "3, 2, 1" ruins the count-in.
            if (!(await confirmStart({ status, signalLevel: signal.level }))) return;
            countdown.begin(type);
          }}
        />
        {countdown.counting !== null && (
          <StartCountdownOverlay remaining={countdown.counting} onCancel={countdown.cancel} />
        )}
      </View>
    );
  }

  const controls = (
    <RecordControls
      recording={isTracking}
      lapCount={snapshot.lapCount}
      showLap={trackLaps}
      onPause={() => void pause()}
      onResume={handleResume}
      onLap={lap}
      onFinish={finishActivity}
      onDiscard={confirmDiscardRun}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {mapView}

      {!fullStats && (
        <>
          <View
            pointerEvents="box-none"
            style={[styles.islandSlot, { top: insets.top + Spacing.three }]}
          >
            <RecordIsland
              activityType={activityType}
              unitSystem={unitSystem}
              data={liveData}
              sportIcon={activeType?.icon ?? 'walk'}
              sportLabel={activityLabel}
              badge={
                !isPaused && signal.level !== 'good' ? (
                  <StatusPill label={signal.label} searching={signal.level === 'searching'} />
                ) : undefined
              }
              onLock={() => setLocked(true)}
              onExpand={() => setFullStats(true)}
              onLayout={(event) => setIslandHeight(event.nativeEvent.layout.height)}
            >
              {snapshot.backgroundOff && !isPaused && (
                <Pressable
                  style={styles.backgroundNote}
                  onPress={() => void getPlatform().background.requestPermission()}
                  accessibilityRole="button"
                  accessibilityLabel="Recording stops when the screen locks. Allow location all the time."
                >
                  <ThemedText type="caption" themeColor="warningText" style={styles.pillText}>
                    Recording stops when the screen locks. Tap to allow location "all the time".
                  </ThemedText>
                </Pressable>
              )}
              {beaconLive && (
                <Pressable
                  style={styles.liveNote}
                  onPress={shareLiveBeacon}
                  accessibilityRole="button"
                  accessibilityLabel="Share live location"
                >
                  <View style={styles.liveDot} />
                  <ThemedText type="caption" style={styles.liveText}>
                    LIVE · Tap to share
                  </ThemedText>
                </Pressable>
              )}
              {isPaused && <PausedBar autoPaused={autoPaused} />}
              {lapCard && (
                <LapCompleteCard
                  lap={lapCard}
                  activityType={activityType}
                  unitSystem={unitSystem}
                />
              )}
            </RecordIsland>
          </View>
          {fix && !locked && (
            <RecordMapControls
              follow={follow}
              tilted={tilted}
              bearing={bearing}
              top={insets.top + Spacing.three + islandHeight + Spacing.two}
              layersBadge={layersBadge}
              onLayers={() => setLayersOpen(true)}
              onToggleTilt={toggleTilt}
              onLocate={() => steer('locate')}
              onCompass={turnNorth}
            >
              <ZoomControls
                onZoomIn={() => zoomBy(1)}
                onZoomOut={() => zoomBy(-1)}
                style={[styles.inlineZoom, { backgroundColor: theme.backgroundElement }]}
                iconColor={theme.text}
                dividerColor={theme.border}
              />
            </RecordMapControls>
          )}
          <View style={styles.sheetSlot}>
            <RecordSheet onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}>
              <GestureDetector gesture={optionsSwipe}>
                <Pressable
                  onPress={() => setFlyoutOpen(!flyoutOpen)}
                  accessibilityRole="button"
                  accessibilityLabel={flyoutOpen ? 'Close options' : 'Open options'}
                >
                  <SheetHandle />
                </Pressable>
              </GestureDetector>
              {flyoutOpen && (
                <RecordFlyout
                  rows={flyoutRows({ trackLaps, mapStyle })}
                  trackLaps={trackLaps}
                  onToggleLaps={setTrackLaps}
                  onOpen={(id) => {
                    setFlyoutOpen(false);
                    if (id === 'settings') router.push('/recording-settings');
                    else setLayersOpen(true);
                  }}
                />
              )}
              <View style={styles.content}>{controls}</View>
            </RecordSheet>
          </View>
        </>
      )}
      {fullStats && (
        <RecordStatsView
          activityType={activityType}
          unitSystem={unitSystem}
          data={liveData}
          paused={isPaused ? { auto: autoPaused } : null}
          lapCard={lapCard}
          onShrink={() => setFullStats(false)}
          controls={controls}
        />
      )}
      <MapLayersSheet
        visible={layersOpen}
        onClose={() => setLayersOpen(false)}
        layers={['poi', 'bikeLanes']}
        previewCenter={fix ? [fix.longitude, fix.latitude] : null}
      />
      {locked && <RecordLockOverlay onUnlock={() => setLocked(false)} />}
    </View>
  );
}

function StatusPill({ label, searching = false }: { label: string; searching?: boolean }) {
  return (
    <View style={[styles.pill, searching && styles.pillSearching]}>
      <ThemedText type="caption" themeColor="warningText" numberOfLines={1} style={styles.pillText}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  mapFull: StyleSheet.absoluteFill,
  inlineZoom: { position: 'relative', right: 0 },
  islandSlot: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  sheetSlot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  pill: {
    flexShrink: 1,
    backgroundColor: tint(Brand.warning, 0.18),
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  pillSearching: { backgroundColor: tint(Brand.primary, 0.15) },
  pillText: { fontWeight: '700' },
  backgroundNote: {
    backgroundColor: tint(Brand.warning, 0.18),
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  content: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  liveNote: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    backgroundColor: Brand.danger,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.white },
  liveText: { color: Brand.white, fontWeight: '700' },
});
