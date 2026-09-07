import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { ThemedText } from '@/components/themed-text';
import { SPORT_TYPES } from '@/constants/activity';
import { DEFAULT_CENTER, MAP_STYLES } from '@/constants/config';
import { BorderRadius, Brand, Colors, ShadowDark, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { motionSensorService } from '@/services/motionSensorService';
import { territoryService } from '@/services/territoryService';
import { trackingService } from '@/services/trackingService';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ActivityType, Location as LocationType, Ring } from '@/types';
import { formatArea, formatDistance, formatDurationLong, formatPace } from '@/utils/format';
import { haptics } from '@/utils/haptics';

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

export default function TrackingScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [location, setLocation] = useState<LocationType | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [showTypePicker, setShowTypePicker] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [trackedPolygon, setTrackedPolygon] = useState<Ring | null>(null);
  const [startLocation, setStartLocation] = useState<[number, number] | null>(null);
  const { useGyroscopeAssist, sensorUpdateRate } = useSettingsStore(
    useShallow((s) => ({
      useGyroscopeAssist: s.useGyroscopeAssist,
      sensorUpdateRate: s.sensorUpdateRate,
    }))
  );
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const wasLoopClosedRef = useRef(false);

  const isSessionActive = isTracking || isPaused;

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
    trackingService.restoreSession().then(() => {
      const wasTracking = trackingService.getIsTracking();
      setIsTracking(wasTracking);
      setDistance(trackingService.getDistance());
      setDuration(trackingService.getDuration());
      if (wasTracking) {
        setShowTypePicker(false);
        const locs = trackingService.getLocations();
        setRouteCoordinates(locs.map((l) => [l.longitude, l.latitude]));
        if (locs.length > 0) {
          setStartLocation([locs[0].longitude, locs[0].latitude]);
          wasLoopClosedRef.current = territoryService.isClosedLoop(locs);
          setTrackedPolygon(territoryService.getEnclosedPolygon(locs));
        }
      }
    });
  }, []);

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

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
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
            setRouteCoordinates((prev) => [...prev, [loc.longitude, loc.latitude]]);

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
  }, [isTracking]);

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
        setRouteCoordinates((prev) => [
          ...prev,
          [interpolatedPoint.longitude, interpolatedPoint.latitude],
        ]);
      }
    }, 500);

    return () => clearInterval(interpolationInterval);
  }, [isTracking, useGyroscopeAssist]);

  useEffect(() => {
    const interval = setInterval(() => {
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
    if (location) {
      setStartLocation([location.longitude, location.latitude]);
    }
  };

  const handlePause = async () => {
    haptics.tap();
    await trackingService.pauseTracking();
    setIsTracking(false);
    setIsPaused(true);
    motionSensorService.stop();
  };

  const handleResume = async () => {
    haptics.tap();
    await trackingService.resumeTracking();
    setIsTracking(true);
    setIsPaused(false);
  };

  const handleStop = () => {
    Alert.alert('Finish Activity?', "You'll be able to review it before it's saved.", [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: finishActivity },
    ]);
  };

  const finishActivity = async () => {
    haptics.success();
    motionSensorService.stop();
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

    await trackingService.stopTracking();
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

  const mapCenter: [number, number] = location
    ? [location.longitude, location.latitude]
    : DEFAULT_CENTER;

  const activeType = ACTIVITY_TYPES.find((t) => t.type === activityType);
  const territoryArea = trackedPolygon ? territoryService.getPolygonArea(trackedPolygon) : 0;

  const markers: MapMarker[] = [];
  if (startLocation && (isTracking || duration > 0)) {
    markers.push({
      id: 'start',
      coordinate: startLocation,
      color: Brand.success,
      icon: 'play',
    });
  }
  if (location && isTracking && routeCoordinates.length > 1) {
    markers.push({
      id: 'current',
      coordinate: [location.longitude, location.latitude],
      color: Brand.primary,
      icon: 'walk',
    });
  }

  if (showTypePicker && !isTracking && duration === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <MapRoute
            initialCenter={mapCenter}
            initialZoom={15}
            mapStyleUrl={MAP_STYLES.darkMatter}
            showUserLocation
          />
        </View>

        <SafeAreaView edges={['bottom']} style={styles.sheetSafeArea}>
          <View style={[styles.bottomSheet, ShadowDark.lg]}>
            <View style={styles.sheetHandle} />
            <ThemedText type="small" style={styles.pickerLabel}>
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
                          backgroundColor: active ? Brand.primary : Colors.dark.backgroundSelected,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={active ? Brand.white : Colors.dark.textSecondary}
                      />
                    </View>
                    <ThemedText
                      type="small"
                      style={{
                        color: active ? Brand.primary : Colors.dark.textSecondary,
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
                haptics.impactMedium();
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
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapRoute
          coordinates={routeCoordinates.length > 1 ? routeCoordinates : undefined}
          territoryPolygons={trackedPolygon ? [trackedPolygon] : []}
          territoryColor={Brand.success}
          territoryOpacity={0.22}
          markers={markers}
          followUser={isTracking ? 'default' : undefined}
          initialCenter={mapCenter}
          initialZoom={15}
          mapStyleUrl={MAP_STYLES.darkMatter}
        />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.sheetSafeArea}>
        <View style={[styles.bottomSheet, ShadowDark.lg]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetContent}>
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
                <ThemedText type="default" style={styles.sheetTitle}>
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
                onPress={() => {
                  haptics.tap();
                  setExpanded((e) => !e);
                }}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Show fewer stats' : 'Show more stats'}
              >
                <Ionicons
                  name={expanded ? 'contract' : 'expand'}
                  size={18}
                  color={Colors.dark.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText type="default" style={styles.statValue}>
                  {formatDurationLong(duration)}
                </ThemedText>
                <ThemedText type="small" style={styles.statLabel}>
                  Time
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="default" style={styles.statValue}>
                  {formatPace(distance, duration)}
                </ThemedText>
                <ThemedText type="small" style={styles.statLabel}>
                  Pace /km
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="default" style={styles.statValue}>
                  {formatDistance(distance)}
                </ThemedText>
                <ThemedText type="small" style={styles.statLabel}>
                  Distance
                </ThemedText>
              </View>
            </View>

            {expanded && (
              <View style={styles.statsRowSecondary}>
                <View style={styles.stat}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={trackedPolygon ? Brand.success : Colors.dark.textSecondary}
                  />
                  <ThemedText
                    type="default"
                    style={[
                      styles.statValueSmall,
                      { color: trackedPolygon ? Brand.success : Colors.dark.text },
                    ]}
                  >
                    {trackedPolygon ? formatArea(territoryArea) : '—'}
                  </ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>
                    Territory
                  </ThemedText>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="location" size={16} color={Colors.dark.textSecondary} />
                  <ThemedText type="default" style={styles.statValueSmall}>
                    {routeCoordinates.length}
                  </ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>
                    GPS points
                  </ThemedText>
                </View>
              </View>
            )}

            <View style={styles.controls}>
              {isTracking ? (
                <View style={styles.controlRow}>
                  <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: Colors.dark.background }]}
                    onPress={handlePause}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Pause activity"
                  >
                    <Ionicons name="pause" size={26} color={Colors.dark.text} />
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
                    style={[styles.controlButton, { backgroundColor: Colors.dark.background }]}
                    onPress={handleResume}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Resume activity"
                  >
                    <Ionicons name="play" size={26} color={Colors.dark.text} />
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
    backgroundColor: Colors.dark.background,
  },
  mapContainer: {
    flex: 1,
  },
  sheetSafeArea: {
    backgroundColor: 'transparent',
  },
  pickerLabel: {
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.backgroundElement,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.four,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.dark.backgroundSelected,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  sheetContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  sheetTitle: {
    color: Colors.dark.text,
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
  },
  statsRowSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  stat: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 30,
    fontVariant: ['tabular-nums'],
  },
  statValueSmall: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 15,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
  },
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
