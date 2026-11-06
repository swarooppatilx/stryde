import { Ionicons } from '@expo/vector-icons';
import { getDocumentAsync } from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { AppButton } from '@/components/button';
import { DrawOverlay } from '@/components/draw-overlay';
import { ChipRow } from '@/components/filter-chips';
import type { MapCamera } from '@/components/map-camera';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { ScrubChart } from '@/components/scrub-chart';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_CENTER, ENV } from '@/constants/config';
import { MapChrome } from '@/constants/mapChrome';
import { BorderRadius, type Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { useRouteElevation } from '@/hooks/useRouteElevation';
import { useSnappedRoute } from '@/hooks/useSnappedRoute';
import { getPlatform } from '@/platform';
import { profileFor, type SnapFailure } from '@/services/directions';
import { generateLoops, headingWords, type LoopSuggestion } from '@/services/loopGenerator';
import { placeAt } from '@/services/placeSearch';
import { resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useRouteStore } from '@/stores/routeStore';
import type { ActivityType } from '@/types';
import { Alert } from '@/utils/alert';
import { formatDistance, formatElevation, toPolyline } from '@/utils/format';
import { MAX_GPX_BYTES } from '@/utils/gpxParse';
import { waypointsFromGpx } from '@/utils/gpxWaypoints';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { LOOP_DISTANCES } from '@/utils/loopRoutes';
import type { RoutePoint } from '@/utils/route';
import { fitPadding, routeBounds } from '@/utils/routeBounds';
import {
  addWaypoint,
  clearWaypoints,
  endAt,
  moveWaypoint,
  outAndBack,
  removeWaypoint,
  reverseWaypoints,
  sampleAlong,
  undoWaypoint,
} from '@/utils/routeBuilder';
import { routeProfile } from '@/utils/routeProfile';
import { simplifyToCount } from '@/utils/simplifyPath';
import { Toast } from '@/utils/toast';

const SPORTS: Array<{ value: ActivityType; label: string }> = [
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'walk', label: 'Walk' },
  { value: 'hike', label: 'Hike' },
];
type PointRole = 'start' | 'finish' | 'via';

function pointRole(index: number, count: number): PointRole {
  if (index === 0) return 'start';
  return index === count - 1 ? 'finish' : 'via';
}

const MARKER_LOOK: Record<
  PointRole,
  (brand: Pick<typeof Brand, 'primary' | 'success' | 'danger'>) => { color: string; icon: string }
> = {
  start: (brand) => ({ color: brand.success, icon: 'play' }),
  finish: (brand) => ({ color: brand.danger, icon: 'flag' }),
  via: (brand) => ({ color: brand.primary, icon: 'ellipse' }),
};
const SAMPLE_STEP_M = 100;
/** A drawn stroke becomes at most this many waypoints: enough for its shape, few enough to route quickly. */
const MAX_DRAWN_POINTS = 24;
/** A GPX track is thinned to this many waypoints: two routing requests' worth. */
const MAX_IMPORTED_WAYPOINTS = 48;
const ELEVATION_DELAY_MS = 700;
/** A flat route's profile spans at least this many metres, so a kerb is not drawn as a hill. */
const ELEVATION_MIN_RANGE_M = 30;

/** What to tell the athlete when the line could not follow the paths. */
const SNAP_FAILURE_TEXT: Record<SnapFailure, string> = {
  'unreachable-point': 'A point is too far from any path; showing straight lines',
  'no-route': "There's no path between these points; showing straight lines",
  'too-far': 'These points are too far apart to route; showing straight lines',
  offline: "You're offline, so the route can't follow paths yet",
  unknown: "Couldn't follow the paths here; showing straight lines",
};

/** Default route names read "<place> run", "<place> ride". */
const SPORT_NOUN: Partial<Record<ActivityType, string>> = {
  run: 'run',
  ride: 'ride',
  walk: 'walk',
  hike: 'hike',
};

/** The loop presets to offer for a sport; anything else gets the running ones. */
function loopSportOf(sport: ActivityType): keyof typeof LOOP_DISTANCES {
  return sport === 'ride' || sport === 'walk' || sport === 'hike' ? sport : 'run';
}

/** "lng,lat" from a route param, or null. */
function parsePoint(value: string | undefined): RoutePoint | null {
  const [lng, lat] = (value ?? '').split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng as number, lat as number] : null;
}

/**
 * Plan a route: tap the map to add points, drag them to adjust. With snapping on, the line
 * follows footpaths, trails and roads for the sport; off, it runs straight between points.
 */
export default function RouteBuilderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const unitSystem = useUnitSystem();
  const params = useLocalSearchParams<{
    to?: string;
    from?: string;
    loop?: string;
    sport?: ActivityType;
  }>();
  const stylePref = useMapPrefsStore((s) => s.style);
  const mapType = useMapPrefsStore((s) => s.mapType);
  const save = useRouteStore((s) => s.save);
  const [center, setCenter] = useState<RoutePoint | null>(null);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [sport, setSport] = useState<ActivityType>(params.sport ?? 'run');
  const [snap, setSnap] = useState(true);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const cameraRef = useRef<MapCamera>(null);
  // Draw mode: one finger traces the route over the map; the stroke becomes waypoints.
  const [drawing, setDrawing] = useState(false);
  const addStroke = async (stroke: Array<[number, number]>) => {
    setDrawing(false);
    const kept = simplifyToCount(stroke, MAX_DRAWN_POINTS, 6);
    const coords = await Promise.all(kept.map((p) => cameraRef.current?.coordinateAt(p) ?? null));
    const drawn = coords.filter((c): c is [number, number] => c !== null);
    if (drawn.length < 2) {
      Toast.info("Couldn't read that drawing; try again", 2);
      return;
    }
    haptics.selection();
    setPoints((current) => [...current, ...drawn]);
  };
  const importGpx = async () => {
    try {
      const picked = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (!asset) return;
      if (!/\.gpx$/i.test(asset.name) || (asset.size ?? 0) > MAX_GPX_BYTES) {
        Toast.info('Choose a GPX file under 8 MB', 2);
        return;
      }
      const track = waypointsFromGpx(
        await getPlatform().files.readText(asset.uri),
        MAX_IMPORTED_WAYPOINTS
      );
      if (!track) {
        Toast.info('That file has no track to load', 2);
        return;
      }
      haptics.selection();
      setPoints(track.points);
      if (track.capped) {
        Toast.info(
          `The track had ${track.original} points; its shape is simplified to ${track.points.length} waypoints`,
          3
        );
      }
    } catch (error) {
      logger.warn('[RouteBuilder] GPX import failed', error);
      Toast.fail("Couldn't read that file", 2);
    }
  };
  const [panelHeight, setPanelHeight] = useState(0);
  // Loop generator: pick a distance, get three loops from the start (or from here).
  const [looping, setLooping] = useState(false);
  const [loopTarget, setLoopTarget] = useState<number>(
    () => LOOP_DISTANCES[loopSportOf(params.sport ?? 'run')][1] as number
  );
  const [loops, setLoops] = useState<LoopSuggestion[] | null>(null);
  const [loopsLoading, setLoopsLoading] = useState(false);
  const [loopSeed, setLoopSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const destination = parsePoint(params.to);
    const origin = parsePoint(params.from);
    // "Start here" or "Loops from here" on a place: it is the start, wherever you are.
    if (origin) {
      setCenter(origin);
      setPoints([origin]);
      if (params.loop === '1') setLooping(true);
      return;
    }
    getPlatform()
      .location.getLastKnown()
      .then((fix) => {
        if (cancelled) return;
        const here: RoutePoint | null = fix ? [fix.longitude, fix.latitude] : null;
        setCenter(here ?? destination ?? DEFAULT_CENTER);
        // "Route here" from a place: from where you are to it.
        if (destination && here) setPoints([here, destination]);
        else if (destination) setPoints([destination]);
        if (params.loop === '1') setLooping(true);
      })
      .catch(() => {
        if (!cancelled) setCenter(destination ?? DEFAULT_CENTER);
      });
    return () => {
      cancelled = true;
    };
  }, [params.to, params.from, params.loop]);

  const snapped = useSnappedRoute(points, profileFor(sport), snap);
  const { line, distance } = snapped;
  const sampled = useMemo(() => sampleAlong(line, SAMPLE_STEP_M), [line]);
  const elevation = useRouteElevation(sampled, ELEVATION_DELAY_MS);
  const profile = elevation.status === 'ready' ? routeProfile(sampled, elevation.elevations) : null;

  // Telling the athlete once that the paths could not be followed is enough.
  const [warnedFailure, setWarnedFailure] = useState(false);
  if (snapped.status === 'failed' && !warnedFailure) {
    setWarnedFailure(true);
    Toast.info(SNAP_FAILURE_TEXT[snapped.failure ?? 'unknown'], 3);
  } else if (snapped.status === 'snapped' && warnedFailure) {
    setWarnedFailure(false);
  }

  const scrubPoint = scrubIndex === null ? undefined : sampled[scrubIndex];
  const markers: MapMarker[] = [
    ...points.map((point, i) => {
      const role = pointRole(i, points.length);
      return {
        id: `point-${i}`,
        coordinate: point,
        draggable: true,
        ...MARKER_LOOK[role](theme.brand),
      };
    }),
    ...(scrubPoint
      ? [{ id: 'scrub', coordinate: scrubPoint, color: theme.text, icon: 'ellipse' }]
      : []),
  ];

  const addPoint = (point: RoutePoint) => {
    haptics.selection();
    setPoints((current) => addWaypoint(current, point));
  };

  const loopSport = loopSportOf(sport);
  const loopOptions = LOOP_DISTANCES[loopSport].map((m) => ({
    value: String(m),
    label: formatDistance(m, unitSystem),
  }));
  const findLoops = async (seed: number) => {
    const start = points[0] ?? center;
    if (!start) return;
    setLoopsLoading(true);
    setLoops(null);
    try {
      const found = await generateLoops(start, loopTarget, profileFor(sport), seed, {
        token: ENV.MAPBOX_ACCESS_TOKEN,
      });
      setLoops(found);
      if (found.length === 0) Toast.info("Couldn't find loops here. Try another distance.", 2);
    } finally {
      setLoopsLoading(false);
    }
  };
  const openLoops = () => {
    // A loop of the right size for the sport, unless the athlete already picked one.
    if (!LOOP_DISTANCES[loopSport].includes(loopTarget)) {
      setLoopTarget(LOOP_DISTANCES[loopSport][1] as number);
    }
    setLoops(null);
    setLooping(true);
  };
  const pickLoop = (loop: LoopSuggestion) => {
    haptics.selection();
    setSnap(true);
    setPoints(loop.waypoints);
    // Show the whole loop in the part of the map the panel leaves visible.
    const bounds = routeBounds(loop.line);
    if (bounds) {
      cameraRef.current?.fitBounds(bounds, {
        padding: fitPadding({ sheetHeight: panelHeight, topInset: insets.top + 90 }),
        duration: 600,
      });
    }
  };

  // Tapping a point offers to move, end at or remove it; "move" takes the next tap on the map.
  const [pointMenu, setPointMenu] = useState<number | null>(null);
  const [movingIndex, setMovingIndex] = useState<number | null>(null);
  const handleMapTap = (point: RoutePoint) => {
    if (movingIndex !== null) {
      haptics.selection();
      setPoints((current) => moveWaypoint(current, movingIndex, point));
      setMovingIndex(null);
      return;
    }
    addPoint(point);
  };
  const pointActions = ((): SheetAction[] => {
    if (pointMenu === null) return [];
    const index = pointMenu;
    const actions: SheetAction[] = [
      { label: 'Move this point', icon: 'move-outline', onPress: () => setMovingIndex(index) },
    ];
    if (index > 0 && index < points.length - 1) {
      actions.push({
        label: 'End the route here',
        icon: 'flag-outline',
        onPress: () => setPoints((c) => endAt(c, index)),
      });
    }
    actions.push({
      label: 'Remove this point',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => setPoints((c) => removeWaypoint(c, index)),
    });
    return actions;
  })();

  const confirmClear = () =>
    Alert.alert('Clear this route?', 'Every point you added will be removed.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setPoints(clearWaypoints()) },
    ]);
  const confirmLeave = () => {
    if (points.length === 0) {
      goBack();
      return;
    }
    Alert.alert('Leave without saving?', 'This route has not been saved yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: goBack },
    ]);
  };
  // A new sport re-routes the line along different paths; check before reshaping it.
  const changeSport = (next: ActivityType) => {
    if (next === sport) return;
    if (!snap || points.length < 2 || profileFor(next) === profileFor(sport)) {
      setSport(next);
      return;
    }
    Alert.alert('Change the sport?', 'The route will be redrawn along paths for the new sport.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change', onPress: () => setSport(next) },
    ]);
  };

  const startSave = () => {
    setName(`Route of ${formatDistance(distance, unitSystem)}`);
    setSaving(true);
    // A friendlier default once the start's place name is known: "Shaniwar Peth run".
    const start = points[0];
    if (start) {
      void placeAt(getPlatform().geocoder, start[1], start[0]).then((place) => {
        if (!/^-?\d/.test(place.name)) {
          setName((current) =>
            current.startsWith('Route of ')
              ? `${place.name} ${SPORT_NOUN[sport] ?? 'route'}`
              : current
          );
        }
      });
    }
  };
  const confirmSave = () => {
    const saved = save({
      name: name.trim() || `Route of ${formatDistance(distance, unitSystem)}`,
      polyline: toPolyline(line),
      distance,
      sport,
      // The estimate shown on this screen, when it has arrived; a drawn route has no duration.
      elevationGain: profile?.gain,
    });
    Toast.success('Route saved', 1);
    router.replace(`/routes/${saved.id}`);
  };

  const elevationNote = (() => {
    if (points.length < 2) return 'Add a second point to see the hills';
    return elevation.status === 'unavailable'
      ? 'Elevation needs a connection'
      : 'Reading the hills…';
  })();

  const hint = (() => {
    if (drawing) return 'Draw your route with one finger.';
    if (movingIndex !== null) return 'Tap the map where this point should go.';
    if (points.length === 0) return 'Tap the map to set your start.';
    if (points.length === 1) return 'Tap again to add the next point. Drag a point to move it.';
    return snap
      ? 'Following paths for this sport. Drag a point to reshape.'
      : 'Straight lines between points.';
  })();

  const panelBody = () => {
    if (looping) {
      return (
        <View style={styles.stack}>
          <ThemedText type="smallBold">
            Loop from {points.length > 0 ? 'your start point' : 'here'}
          </ThemedText>
          <ChipRow
            options={loopOptions}
            value={String(loopTarget)}
            onChange={(value) => setLoopTarget(Number(value))}
            contentStyle={styles.chips}
          />
          {loopsLoading && (
            <ActivityIndicator color={theme.brand.primary} accessibilityLabel="Finding loops" />
          )}
          {loops?.map((loop, i) => (
            <Tappable
              key={`${loop.bearing}-${i}`}
              onPress={() => pickLoop(loop)}
              style={[styles.loopCard, { backgroundColor: theme.background }]}
              accessibilityRole="button"
              accessibilityLabel={`${formatDistance(loop.distance, unitSystem)} loop, ${headingWords(loop.bearing)}`}
            >
              <Ionicons name="sync-outline" size={20} color={theme.brand.primary} />
              <View style={styles.loopText}>
                <ThemedText type="smallBold">
                  {formatDistance(loop.distance, unitSystem)}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {headingWords(loop.bearing)}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Tappable>
          ))}
          <View style={styles.tools}>
            <AppButton
              size="small"
              fullWidth={false}
              disabled={loopsLoading}
              onPress={() => {
                const next = loops ? loopSeed + 1 : loopSeed;
                setLoopSeed(next);
                void findLoops(next);
              }}
            >
              {loops ? 'Show others' : 'Find loops'}
            </AppButton>
            <AppButton
              variant="ghost"
              size="small"
              fullWidth={false}
              onPress={() => setLooping(false)}
            >
              Done
            </AppButton>
          </View>
        </View>
      );
    }
    if (saving) {
      return (
        <View style={styles.stack}>
          <TextField label="Route name" value={name} onChangeText={setName} maxLength={60} />
          <AppButton onPress={confirmSave}>Save route</AppButton>
          <AppButton variant="ghost" onPress={() => setSaving(false)}>
            Keep editing
          </AppButton>
        </View>
      );
    }
    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tools}
        >
          <AppButton
            variant={drawing ? 'primary' : 'secondary'}
            size="small"
            fullWidth={false}
            onPress={() => setDrawing((on) => !on)}
          >
            {drawing ? 'Stop drawing' : 'Draw'}
          </AppButton>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth={false}
            onPress={() => void importGpx()}
          >
            Import GPX
          </AppButton>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth={false}
            disabled={!ENV.MAPBOX_ACCESS_TOKEN}
            onPress={openLoops}
          >
            Loop
          </AppButton>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth={false}
            disabled={points.length === 0}
            onPress={() => setPoints(undoWaypoint)}
          >
            Undo
          </AppButton>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth={false}
            disabled={points.length < 2}
            onPress={() => setPoints(outAndBack)}
          >
            Out & back
          </AppButton>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth={false}
            disabled={points.length < 2}
            onPress={() => setPoints(reverseWaypoints)}
          >
            Reverse
          </AppButton>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth={false}
            disabled={points.length === 0}
            onPress={confirmClear}
          >
            Clear
          </AppButton>
        </ScrollView>
        <AppButton disabled={points.length < 2 || snapped.status === 'loading'} onPress={startSave}>
          Save route
        </AppButton>
      </>
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      {center && (
        <MapRoute
          cameraRef={cameraRef}
          coordinates={line.length > 1 ? line : undefined}
          markers={markers}
          initialCenter={center}
          initialZoom={15}
          showUserLocation={false}
          onMapPress={handleMapTap}
          onMapLongPress={handleMapTap}
          onMarkerPress={(id) => {
            const index = Number(id.replace('point-', ''));
            if (Number.isInteger(index)) setPointMenu(index);
          }}
          onMarkerDragEnd={(id, point) => {
            const index = Number(id.replace('point-', ''));
            if (Number.isInteger(index))
              setPoints((current) => moveWaypoint(current, index, point));
          }}
          dark={resolveMapStyle(stylePref, theme.isDark) === 'dark'}
          mapType={mapType}
          compassTopOffset={insets.top + MapChrome.edge + 56}
        />
      )}
      {drawing && <DrawOverlay onStroke={(stroke) => void addStroke(stroke)} />}
      <View style={[styles.top, { top: insets.top + MapChrome.edge }]}>
        <Tappable
          onPress={confirmLeave}
          style={[styles.round, theme.shadows.raised, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Tappable>
        <View
          style={[styles.hint, theme.shadows.raised, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
            {hint}
          </ThemedText>
        </View>
        <Tappable
          onPress={() => setSnap((on) => !on)}
          style={[
            styles.round,
            theme.shadows.raised,
            { backgroundColor: snap ? theme.brand.primary : theme.backgroundElement },
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: snap }}
          accessibilityLabel="Follow paths"
        >
          <Ionicons
            name="git-branch-outline"
            size={22}
            color={snap ? theme.background : theme.text}
          />
        </Tappable>
      </View>
      <View
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
        style={[
          styles.panel,
          theme.shadows.sheet,
          {
            backgroundColor: theme.backgroundElement,
            paddingBottom: insets.bottom + Spacing.three,
          },
        ]}
      >
        <ChipRow
          options={SPORTS}
          value={sport}
          onChange={changeSport}
          contentStyle={styles.chips}
        />
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText type="sectionTitle">{formatDistance(distance, unitSystem)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Distance
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText type="sectionTitle">
              {profile ? formatElevation(profile.gain, unitSystem) : '—'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Elevation gain
            </ThemedText>
          </View>
          {snapped.status === 'loading' && (
            <ActivityIndicator
              size="small"
              color={theme.textSecondary}
              accessibilityLabel="Finding paths"
            />
          )}
        </View>

        {/* While choosing a loop the chart would push the loop itself off the map. */}
        {!looping &&
          (profile ? (
            <ScrubChart
              title="Elevation"
              values={profile.values}
              times={profile.times}
              formatValue={(v) => formatElevation(v, unitSystem)}
              summary={`${formatElevation(profile.gain, unitSystem)} up, ${formatElevation(profile.loss, unitSystem)} down`}
              onScrubChange={setScrubIndex}
              minRange={ELEVATION_MIN_RANGE_M}
              accessibilityLabel={`Elevation along the route, ${formatElevation(profile.gain, unitSystem)} up and ${formatElevation(profile.loss, unitSystem)} down. Drag across it to see the spot on the map.`}
            />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
              {elevationNote}
            </ThemedText>
          ))}

        {panelBody()}
      </View>
      <ActionSheet
        visible={pointMenu !== null}
        title={pointMenu === 0 ? 'Start point' : 'Route point'}
        actions={pointActions}
        onClose={() => setPointMenu(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    position: 'absolute',
    left: MapChrome.edge,
    right: MapChrome.edge,
    flexDirection: 'row',
    alignItems: 'center',
    gap: MapChrome.gap,
  },
  round: {
    width: MapChrome.fab,
    height: MapChrome.fab,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.two,
    padding: Spacing.four,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  chips: { paddingHorizontal: 0 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  stat: { gap: 2 },
  tools: { gap: Spacing.two },
  stack: { gap: Spacing.two },
  loopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  loopText: { flex: 1 },
});
