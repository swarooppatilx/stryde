import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { ScrubChart } from '@/components/scrub-chart';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_CENTER } from '@/constants/config';
import { MapChrome } from '@/constants/mapChrome';
import { BorderRadius, type Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { useRouteElevation } from '@/hooks/useRouteElevation';
import { useSnappedRoute } from '@/hooks/useSnappedRoute';
import { getPlatform } from '@/platform';
import { profileFor } from '@/services/directions';
import { resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useRouteStore } from '@/stores/routeStore';
import type { ActivityType } from '@/types';
import { formatDistance, formatElevation, toPolyline } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import type { RoutePoint } from '@/utils/route';
import {
  addWaypoint,
  clearWaypoints,
  moveWaypoint,
  outAndBack,
  reverseWaypoints,
  sampleAlong,
  undoWaypoint,
} from '@/utils/routeBuilder';
import { routeProfile } from '@/utils/routeProfile';
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
const ELEVATION_DELAY_MS = 700;

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
  const params = useLocalSearchParams<{ to?: string; sport?: ActivityType }>();
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

  useEffect(() => {
    let cancelled = false;
    const destination = parsePoint(params.to);
    getPlatform()
      .location.getLastKnown()
      .then((fix) => {
        if (cancelled) return;
        const here: RoutePoint | null = fix ? [fix.longitude, fix.latitude] : null;
        setCenter(here ?? destination ?? DEFAULT_CENTER);
        // "Route here" from a place: from where you are to it.
        if (destination && here) setPoints([here, destination]);
        else if (destination) setPoints([destination]);
      })
      .catch(() => {
        if (!cancelled) setCenter(destination ?? DEFAULT_CENTER);
      });
    return () => {
      cancelled = true;
    };
  }, [params.to]);

  const snapped = useSnappedRoute(points, profileFor(sport), snap);
  const { line, distance } = snapped;
  const sampled = useMemo(() => sampleAlong(line, SAMPLE_STEP_M), [line]);
  const elevation = useRouteElevation(sampled, ELEVATION_DELAY_MS);
  const profile = elevation.status === 'ready' ? routeProfile(sampled, elevation.elevations) : null;

  // Telling the athlete once that the paths could not be followed is enough.
  const [warnedFailure, setWarnedFailure] = useState(false);
  if (snapped.status === 'failed' && !warnedFailure) {
    setWarnedFailure(true);
    Toast.info("Couldn't follow the paths here; showing straight lines", 2);
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

  const startSave = () => {
    setName(`Route of ${formatDistance(distance, unitSystem)}`);
    setSaving(true);
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
    if (points.length === 0) return 'Tap the map to set your start.';
    if (points.length === 1) return 'Tap again to add the next point. Drag a point to move it.';
    return snap
      ? 'Following paths for this sport. Drag a point to reshape.'
      : 'Straight lines between points.';
  })();

  return (
    <ThemedView type="background" style={styles.container}>
      {center && (
        <MapRoute
          coordinates={line.length > 1 ? line : undefined}
          markers={markers}
          initialCenter={center}
          initialZoom={15}
          showUserLocation={false}
          onMapPress={addPoint}
          onMapLongPress={addPoint}
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
      <View style={[styles.top, { top: insets.top + MapChrome.edge }]}>
        <Tappable
          onPress={goBack}
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
        style={[
          styles.panel,
          theme.shadows.sheet,
          {
            backgroundColor: theme.backgroundElement,
            paddingBottom: insets.bottom + Spacing.three,
          },
        ]}
      >
        <ChipRow options={SPORTS} value={sport} onChange={setSport} contentStyle={styles.chips} />
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

        {profile ? (
          <ScrubChart
            title="Elevation"
            values={profile.values}
            times={profile.times}
            formatValue={(v) => formatElevation(v, unitSystem)}
            summary={`${formatElevation(profile.gain, unitSystem)} up, ${formatElevation(profile.loss, unitSystem)} down`}
            onScrubChange={setScrubIndex}
            accessibilityLabel={`Elevation along the route, ${formatElevation(profile.gain, unitSystem)} up and ${formatElevation(profile.loss, unitSystem)} down. Drag across it to see the spot on the map.`}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {elevationNote}
          </ThemedText>
        )}

        {saving ? (
          <View style={styles.stack}>
            <TextField label="Route name" value={name} onChangeText={setName} maxLength={60} />
            <AppButton onPress={confirmSave}>Save route</AppButton>
            <AppButton variant="ghost" onPress={() => setSaving(false)}>
              Keep editing
            </AppButton>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tools}
            >
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
                onPress={() => setPoints(clearWaypoints())}
              >
                Clear
              </AppButton>
            </ScrollView>
            <AppButton
              disabled={points.length < 2 || snapped.status === 'loading'}
              onPress={startSave}
            >
              Save route
            </AppButton>
          </>
        )}
      </View>
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
});
