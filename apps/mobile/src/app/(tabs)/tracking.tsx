import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { NumberFlow } from '@/components/number-flow';
import { ThemedText } from '@/components/themed-text';
import { SPORT_TYPES } from '@/constants/activity';
import { DEFAULT_CENTER, MAP_STYLES } from '@/constants/config';
import { BorderRadius, Brand, Shadow, ShadowDark, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  clearBackgroundPoints,
  peekBackgroundPoints,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/services/backgroundLocationService';
import { motionSensorService } from '@/services/motionSensorService';
import { territoryService } from '@/services/territoryService';
import { trackingService } from '@/services/trackingService';
import { ACCURACY_MODE_CONFIG, useSettingsStore } from '@/stores/settingsStore';
import type { ActivityType, Location as LocationType, Ring } from '@/types';
import { Alert } from '@/utils/alert';
import { formatArea, formatDistance, formatDurationLong, formatPace } from '@/utils/format';
import { haptics, impactHeavy, impactMedium, notificationSuccess } from '@/utils/haptics';

const ACTIVITY_TYPES = SPORT_TYPES;

const SPEED_LIMITS_KMH: Record<ActivityType, number> = {
  run: 25,
  walk: 10,
  hike: 15,
  ride: 50,
  swim: 8,
  yoga: 5,
  workout: 10,
  hiit: 15,
  dance: 15,
  climb: 10,
  skate: 20,
  row: 15,
};

const SHEET_SPRING = { damping: 22, stiffness: 200 };

const ROUTE_SYNC_INTERVAL_MS = 1000;
const MAX_ROUTE_POINTS = 2000;

export default function TrackingScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [location, setLocation] = useState<LocationType | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [showTypePicker, setShowTypePicker] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [secondaryStatsHeight, setSecondaryStatsHeight] = useState(0);
  const expandProgress = useSharedValue(0);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const lastRouteSyncRef = useRef(0);
  const [routePointCount, setRoutePointCount] = useState(0);
  const [trackedPolygon, setTrackedPolygon] = useState<Ring | null>(null);
  const [startLocation, setStartLocation] = useState<[number, number] | null>(null);
  const { useGyroscopeAssist, sensorUpdateRate, autoPause, accuracyMode } = useSettingsStore(
    useShallow((s) => ({
      useGyroscopeAssist: s.useGyroscopeAssist,
      sensorUpdateRate: s.sensorUpdateRate,
      autoPause: s.autoPause,
      accuracyMode: s.accuracyMode,
    }))
  );
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const wasLoopClosedRef = useRef(false);

  const syncRouteToState = useCallback(() => {
    lastRouteSyncRef.current = Date.now();
    const coords = routeCoordsRef.current;
    if (coords.length > MAX_ROUTE_POINTS) {
      const stride = Math.ceil(coords.length / MAX_ROUTE_POINTS);
      const downsampled: [number, number][] = [];
      for (let i = 0; i < coords.length; i += stride) {
        downsampled.push(coords[i]);
      }
      const last = coords[coords.length - 1];
      if (downsampled[downsampled.length - 1] !== last) {
        downsampled.push(last);
      }
      routeCoordsRef.current = downsampled;
      setRoutePointCount(downsampled.length);
      setRouteCoordinates(downsampled);
    } else {
      setRouteCoordinates(coords);
    }
  }, []);

  const pushRoutePoint = useCallback(
    (lng: number, lat: number) => {
      routeCoordsRef.current.push([lng, lat]);
      setRoutePointCount(routeCoordsRef.current.length);
      if (Date.now() - lastRouteSyncRef.current >= ROUTE_SYNC_INTERVAL_MS) {
        syncRouteToState();
      }
    },
    [syncRouteToState]
  );

  const isSessionActive = isTracking || isPaused;

  useEffect(() => {
    expandProgress.value = withSpring(expanded ? 1 : 0, SHEET_SPRING);
  }, [expanded, expandProgress]);

  const secondaryStatsStyle = useAnimatedStyle(() => ({
    height: secondaryStatsHeight * expandProgress.value,
    opacity: expandProgress.value,
  }));

  const onSecondaryStatsLayout = useCallback((event: LayoutChangeEvent) => {
    setSecondaryStatsHeight(event.nativeEvent.layout.height);
  }, []);

  const setSheetExpanded = useCallback((next: boolean) => {
    haptics.tap();
    setExpanded(next);
  }, []);

  const sheetPanGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationY < -15 || event.velocityY < -400) {
        runOnJS(setSheetExpanded)(true);
      } else if (event.translationY > 15 || event.velocityY > 400) {
        runOnJS(setSheetExpanded)(false);
      }
    });

  // Recording is meant to feel immersive and full-screen, like a dedicated
  // stopwatch - the tab bar competing for space (and being one accidental
  // tap away) undermines that while a session is live.
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isSessionActive
        ? { display: 'none' }
        : { backgroundColor: theme.background, borderTopColor: theme.border },
    });
    return () => {
      navigation.setOptions({
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
      });
    };
  }, [isSessionActive, navigation, theme.background, theme.border]);

  useEffect(() => {
    trackingService.restoreSession().then(async () => {
      const wasTracking = trackingService.getIsTracking();
      if (wasTracking) {
        // Merge any fixes the background task buffered while we were away.
        const buffered = await peekBackgroundPoints();
        if (buffered.length > 0) {
          for (const p of buffered) {
            const loc: LocationType = {
              latitude: p.latitude,
              longitude: p.longitude,
              timestamp: p.timestamp,
              accuracy: p.accuracy,
            };
            trackingService.addLocation(loc);
            pushRoutePoint(loc.longitude, loc.latitude);
          }
          await clearBackgroundPoints();
        }
      }
      setIsTracking(wasTracking);
      setIsPaused(trackingService.getIsAutoPaused());
      setDistance(trackingService.getDistance());
      setDuration(trackingService.getDuration());
      if (wasTracking) {
        setShowTypePicker(false);
        const locs = trackingService.getLocations();
        const route: [number, number][] = locs.map((l) => [l.longitude, l.latitude]);
        routeCoordsRef.current = route;
        lastRouteSyncRef.current = Date.now();
        setRoutePointCount(route.length);
        setRouteCoordinates(route);
        if (locs.length > 0) {
          setStartLocation([locs[0].longitude, locs[0].latitude]);
          wasLoopClosedRef.current = territoryService.isClosedLoop(locs);
          setTrackedPolygon(territoryService.getEnclosedPolygon(locs));
        }
      }
    });
  }, [pushRoutePoint]);

  // When the app returns to the foreground mid-session, pull in whatever the
  // background task buffered while it was away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      if (!trackingService.getIsTracking()) return;
      const buffered = await peekBackgroundPoints();
      if (buffered.length === 0) return;
      for (const p of buffered) {
        const loc: LocationType = {
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
          accuracy: p.accuracy,
        };
        trackingService.addLocation(loc);
        pushRoutePoint(loc.longitude, loc.latitude);
      }
      await clearBackgroundPoints();
      setDistance(
        useGyroscopeAssist
          ? trackingService.getInterpolatedDistance()
          : trackingService.getDistance()
      );
      setDuration(trackingService.getDuration());
      const locs = trackingService.getLocations();
      wasLoopClosedRef.current = territoryService.isClosedLoop(locs);
      setTrackedPolygon(territoryService.getEnclosedPolygon(locs));
    });
    return () => sub.remove();
  }, [pushRoutePoint, useGyroscopeAssist]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationUpdates = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Required',
            'Please enable location access to track your activities.',
            [{ text: 'OK' }]
          );
          setIsTracking(false);
          return;
        }

        const accuracyByMode = {
          best: Location.Accuracy.BestForNavigation,
          balanced: Location.Accuracy.Balanced,
          power: Location.Accuracy.Low,
        } as const;

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: accuracyByMode[accuracyMode],
            timeInterval: ACCURACY_MODE_CONFIG[accuracyMode].timeInterval,
            distanceInterval: 1,
          },
          (newLocation) => {
            const loc: LocationType = {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              timestamp: newLocation.timestamp,
              accuracy: newLocation.coords.accuracy || 0,
            };
            setLocation(loc);
            trackingService.addLocation(loc);
            pushRoutePoint(loc.longitude, loc.latitude);

            const locs = trackingService.getLocations();
            const isClosed = territoryService.isClosedLoop(locs);
            wasLoopClosedRef.current = isClosed;
            setTrackedPolygon(territoryService.getEnclosedPolygon(locs));
          }
        );
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes('unsatisfied device settings')
            ? 'Turn on device location (GPS) to track this activity.'
            : 'Unable to access your location.';
        Alert.alert('Location Error', message, [{ text: 'OK' }]);
        setIsTracking(false);
      }
    };

    if (isTracking) {
      startLocationUpdates();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [isTracking, pushRoutePoint, accuracyMode]);

  useEffect(() => {
    if (isTracking && useGyroscopeAssist) {
      trackingService.setUseGyroscope(true);
      motionSensorService.start({
        rate: sensorUpdateRate,
      });
    } else {
      trackingService.setUseGyroscope(false);
      motionSensorService.stop();
    }

    return () => {
      motionSensorService.stop();
    };
  }, [isTracking, useGyroscopeAssist, sensorUpdateRate]);

  useEffect(() => {
    if (!isTracking || !useGyroscopeAssist) return;

    const interpolationInterval = setInterval(() => {
      const interpolatedPoint = trackingService.generateInterpolatedPoint();
      if (interpolatedPoint) {
        pushRoutePoint(interpolatedPoint.longitude, interpolatedPoint.latitude);
      }
    }, 500);

    return () => clearInterval(interpolationInterval);
  }, [isTracking, useGyroscopeAssist, pushRoutePoint]);

  useEffect(() => {
    trackingService.setAutoPauseEnabled(autoPause);
  }, [autoPause]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (trackingService.getIsAutoPaused()) {
        setIsPaused(true);
        setIsTracking(false);
      }
      if (isTracking) {
        const newDistance = useGyroscopeAssist
          ? trackingService.getInterpolatedDistance()
          : trackingService.getDistance();
        setDistance(newDistance);
        setDuration(trackingService.getDuration());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking, useGyroscopeAssist]);

  const handleStart = async () => {
    trackingService.setMaxSpeed(SPEED_LIMITS_KMH[activityType]);
    await trackingService.startTracking();
    setIsTracking(true);
    setIsPaused(false);
    setShowTypePicker(false);
    wasLoopClosedRef.current = false;
    routeCoordsRef.current = [];
    lastRouteSyncRef.current = 0;
    setRoutePointCount(0);
    setRouteCoordinates([]);
    if (location) {
      setStartLocation([location.longitude, location.latitude]);
    }
    startBackgroundLocation(accuracyMode, activeType?.label ?? activityType);
  };

  const handlePause = async () => {
    impactMedium();
    await trackingService.pauseTracking();
    stopBackgroundLocation();
    setIsTracking(false);
    setIsPaused(true);
    motionSensorService.stop();
  };

  const handleResume = async () => {
    impactMedium();
    await trackingService.resumeTracking();
    setIsTracking(true);
    setIsPaused(false);
    startBackgroundLocation(accuracyMode, activeType?.label ?? activityType);
  };

  const handleStop = () => {
    Alert.alert('Finish Activity?', "You'll be able to review it before it's saved.", [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: finishActivity },
    ]);
  };

  const finishActivity = async () => {
    notificationSuccess();
    stopBackgroundLocation();
    motionSensorService.stop();

    // Fold in whatever the background task captured since the last live fix
    // (app was backgrounded) so distance/route/territory stay complete.
    const buffered = await peekBackgroundPoints();
    if (buffered.length > 0) {
      for (const p of buffered) {
        trackingService.addLocation({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
          accuracy: p.accuracy,
        });
      }
      await clearBackgroundPoints();
    }

    const locations = trackingService.getLocations();
    const finalDistance = useGyroscopeAssist
      ? trackingService.getInterpolatedDistance()
      : trackingService.getDistance();
    const finalDuration = trackingService.getDuration();
    const polyline = useGyroscopeAssist
      ? trackingService.generateInterpolatedPolyline()
      : trackingService.generatePolyline();
    const territory = territoryService.getEnclosedPolygon(locations);
    const territoryArea = territory ? territoryService.getPolygonArea(territory) : 0;

    const result = await trackingService.stopTracking();
    if (!result.success) {
      Alert.alert('Activity Too Short', result.error ?? 'Please try again.');
      setIsTracking(false);
      setIsPaused(false);
      return;
    }
    setIsTracking(false);
    setIsPaused(false);
    setExpanded(false);

    const goToCreateActivity = () => {
      router.push({
        pathname: '/create-activity',
        params: {
          polyline,
          distance: String(finalDistance),
          duration: String(finalDuration),
          territoryArea: String(territoryArea),
          activityType,
          ...(territory ? { territory: JSON.stringify(territory) } : {}),
        },
      });
    };

    if (territory) {
      goToCreateActivity();
    } else {
      Alert.alert(
        'No Territory Captured',
        'Your route needs to loop back to where you started to claim the ground you covered.',
        [{ text: 'OK', onPress: goToCreateActivity }]
      );
    }
  };

  const mapCenter: [number, number] = useMemo(
    () => (location ? [location.longitude, location.latitude] : DEFAULT_CENTER),
    [location]
  );

  const activeType = ACTIVITY_TYPES.find((t) => t.type === activityType);
  const territoryArea = trackedPolygon ? territoryService.getPolygonArea(trackedPolygon) : 0;

  const markers: MapMarker[] = useMemo(() => {
    const next: MapMarker[] = [];
    if (startLocation && (isTracking || duration > 0)) {
      next.push({
        id: 'start',
        coordinate: startLocation,
        color: Brand.success,
        icon: 'play',
      });
    }
    if (location && isTracking && routePointCount > 1) {
      next.push({
        id: 'current',
        coordinate: [location.longitude, location.latitude],
        color: Brand.primary,
        icon: 'walk',
      });
    }
    return next;
  }, [startLocation, location, isTracking, duration, routePointCount]);

  const territoryPolygons = useMemo<Ring[]>(
    () => (trackedPolygon ? [trackedPolygon] : []),
    [trackedPolygon]
  );

  if (showTypePicker && !isTracking && duration === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.mapContainer}>
          <MapRoute
            initialCenter={mapCenter}
            initialZoom={15}
            mapStyleUrl={theme.isDark ? MAP_STYLES.darkMatter : MAP_STYLES.voyager}
            showUserLocation
          />
        </View>

        <SafeAreaView edges={['bottom']} style={styles.sheetSafeArea}>
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.backgroundElement },
              theme.isDark ? ShadowDark.lg : Shadow.lg,
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="small" style={[styles.pickerLabel, { color: theme.textSecondary }]}>
              Choose an activity
            </ThemedText>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sportRow}
            >
              {ACTIVITY_TYPES.map((item) => {
                const active = activityType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => {
                      haptics.selection();
                      setActivityType(item.type);
                    }}
                    style={styles.sportItem}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: active }}
                  >
                    <View
                      style={[
                        styles.sportIconCircle,
                        {
                          backgroundColor: active ? Brand.primary : theme.backgroundSelected,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={active ? Brand.white : theme.textSecondary}
                      />
                    </View>
                    <ThemedText
                      type="small"
                      style={{
                        color: active ? Brand.primary : theme.textSecondary,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {item.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.startButton}
              onPress={() => {
                impactHeavy();
                handleStart();
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Start ${activeType?.label}`}
            >
              <Ionicons name="play" size={22} color={Brand.white} />
              <ThemedText type="default" style={styles.startButtonLabel}>
                Start {activeType?.label}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.mapContainer}>
        <MapRoute
          coordinates={routeCoordinates.length > 1 ? routeCoordinates : undefined}
          territoryPolygons={territoryPolygons}
          territoryColor={Brand.success}
          territoryOpacity={0.22}
          markers={markers}
          followUser={isTracking ? 'default' : undefined}
          initialCenter={mapCenter}
          initialZoom={15}
          mapStyleUrl={theme.isDark ? MAP_STYLES.darkMatter : MAP_STYLES.voyager}
        />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.sheetSafeArea}>
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.backgroundElement },
            theme.isDark ? ShadowDark.lg : Shadow.lg,
          ]}
        >
          <GestureDetector gesture={sheetPanGesture}>
            <View>
              <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View
                    style={[
                      styles.activityIconCircle,
                      { backgroundColor: tint(Brand.primary, 0.15) },
                    ]}
                  >
                    <Ionicons name={activeType?.icon || 'walk'} size={16} color={Brand.primary} />
                  </View>
                  <ThemedText type="default" style={[styles.sheetTitle, { color: theme.text }]}>
                    {activeType?.label}
                  </ThemedText>
                  {isPaused && (
                    <View style={styles.pausedBadge}>
                      <ThemedText type="small" style={styles.pausedBadgeText}>
                        Paused
                      </ThemedText>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setSheetExpanded(!expanded)}
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? 'Show fewer stats' : 'Show more stats'}
                >
                  <Ionicons
                    name={expanded ? 'contract' : 'expand'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </GestureDetector>

          <View style={styles.sheetContent}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText type="default" style={[styles.statValue, { color: theme.text }]}>
                  {formatDurationLong(duration)}
                </ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Time
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="default" style={[styles.statValue, { color: theme.text }]}>
                  {formatPace(distance, duration)}
                </ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Pace /km
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="default" style={[styles.statValue, { color: theme.text }]}>
                  {formatDistance(distance)}
                </ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Distance
                </ThemedText>
              </View>
            </View>

            <Animated.View style={[styles.statsRowSecondary, secondaryStatsStyle]}>
              <View
                style={[styles.statsRowSecondaryInner, { borderTopColor: theme.border }]}
                onLayout={onSecondaryStatsLayout}
              >
                <View style={styles.stat}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={trackedPolygon ? Brand.success : theme.textSecondary}
                  />
                  <ThemedText
                    type="default"
                    style={[
                      styles.statValueSmall,
                      { color: trackedPolygon ? Brand.success : theme.text },
                    ]}
                  >
                    {trackedPolygon ? formatArea(territoryArea) : '—'}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={[styles.statLabel, { color: theme.textSecondary }]}
                  >
                    Territory
                  </ThemedText>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="location" size={16} color={theme.textSecondary} />
                  <NumberFlow
                    value={routePointCount}
                    fontSize={15}
                    fontWeight="700"
                    color={theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={[styles.statLabel, { color: theme.textSecondary }]}
                  >
                    GPS points
                  </ThemedText>
                </View>
              </View>
            </Animated.View>

            <View style={styles.controls}>
              {isTracking ? (
                <View style={styles.controlRow}>
                  <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: theme.background }]}
                    onPress={handlePause}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Pause activity"
                  >
                    <Ionicons name="pause" size={26} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.controlButton, styles.stopButton]}
                    onPress={handleStop}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Finish activity"
                  >
                    <Ionicons name="square" size={22} color={Brand.white} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.controlRow}>
                  <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: theme.background }]}
                    onPress={handleResume}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Resume activity"
                  >
                    <Ionicons name="play" size={26} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.controlButton, styles.stopButton]}
                    onPress={handleStop}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Finish activity"
                  >
                    <Ionicons name="square" size={22} color={Brand.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  sheetSafeArea: {
    backgroundColor: 'transparent',
  },
  pickerLabel: {
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  sportRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  sportItem: {
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 64,
  },
  sportIconCircle: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.three,
    marginHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  startButtonLabel: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 16,
  },
  bottomSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.four,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  sheetContent: {
    paddingHorizontal: Spacing.four,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  sheetTitle: {
    fontWeight: '700',
    fontSize: 17,
  },
  activityIconCircle: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedBadge: {
    backgroundColor: tint(Brand.warning, 0.18),
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  pausedBadgeText: {
    color: Brand.warning,
    fontWeight: '700',
    fontSize: 11,
  },
  expandButton: {
    padding: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  statsRowSecondary: {
    overflow: 'hidden',
  },
  statsRowSecondaryInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: {
    fontWeight: '700',
    fontSize: 30,
    fontVariant: ['tabular-nums'],
  },
  statValueSmall: {
    fontWeight: '700',
    fontSize: 15,
  },
  statLabel: {},
  controls: {
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  controlButton: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: Brand.danger,
  },
});
