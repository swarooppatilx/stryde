import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_CENTER } from '@/constants/config';
import { MapChrome } from '@/constants/mapChrome';
import { BorderRadius, type Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useGoBack } from '@/hooks/useGoBack';
import { useRouteElevation } from '@/hooks/useRouteElevation';
import { useRouteSnapping } from '@/hooks/useRouteSnapping';
import { getPlatform } from '@/platform';
import { resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useRouteStore } from '@/stores/routeStore';
import type { ActivityType } from '@/types';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { formatDistance, formatElevation, toPolyline } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import type { RoutePoint } from '@/utils/route';
import { sampleAlong } from '@/utils/routeBuilder';
import {
  addPoint,
  deletePoint,
  emptyPlan,
  planDistance,
  planLine,
  resnapPlan,
  reversePlan,
  routingProfileFor,
} from '@/utils/routePlan';
import { routeProfile } from '@/utils/routeProfile';
import { Toast } from '@/utils/toast';

const SPORTS: Array<{ value: ActivityType; label: string }> = [
  { value: 'run', label: 'Running' },
  { value: 'ride', label: 'Cycling' },
  { value: 'walk', label: 'Walking' },
  { value: 'hike', label: 'Hiking' },
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

/** Plan a route: press and hold the map to drop points, joined by straight lines. */
export default function RouteBuilderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const unitSystem = useUnitSystem();
  const stylePref = useMapPrefsStore((s) => s.style);
  const save = useRouteStore((s) => s.save);
  const [center, setCenter] = useState<RoutePoint | null>(null);
  const [plan, setPlan] = useState(emptyPlan);
  const [manual, setManual] = useState(false);
  const points = plan.waypoints;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [sport, setSport] = useState<ActivityType>('run');
  const { allowLeave } = useDiscardGuard(points.length > 0);
  const profileName = routingProfileFor(sport);
  const [snapFailed, setSnapFailed] = useState(false);
  useRouteSnapping(plan, setPlan, profileName, (reason) => {
    const message = services.routing.routingErrorMessage(reason);
    // One toast per stretch of trouble, not one per tapped point.
    if (message && !snapFailed) Toast.fail(message, 2.5);
    if (message) setSnapFailed(true);
  });

  useEffect(() => {
    let cancelled = false;
    getPlatform()
      .location.getLastKnown()
      .then((fix) => {
        if (!cancelled) setCenter(fix ? [fix.longitude, fix.latitude] : DEFAULT_CENTER);
      })
      .catch(() => {
        if (!cancelled) setCenter(DEFAULT_CENTER);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const line = useMemo(() => planLine(plan), [plan]);
  const distance = planDistance(plan);
  const sampled = useMemo(() => sampleAlong(line, SAMPLE_STEP_M), [line]);
  const elevation = useRouteElevation(sampled, ELEVATION_DELAY_MS);
  const profile = elevation.status === 'ready' ? routeProfile(sampled, elevation.elevations) : null;

  const markers: MapMarker[] = points.map((point, i) => {
    const role = pointRole(i, points.length);
    return { id: `point-${i}`, coordinate: point, ...MARKER_LOOK[role](theme.brand) };
  });
  const elevationText = (() => {
    if (points.length < 2) return 'Add a second point to see the hills';
    if (profile) {
      return `${formatElevation(profile.gain, unitSystem)} up, ${formatElevation(profile.loss, unitSystem)} down (estimate)`;
    }
    return elevation.status === 'unavailable'
      ? 'Elevation needs a connection'
      : 'Reading the hills…';
  })();

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
    allowLeave();
    router.replace(`/routes/${saved.id}`);
  };

  return (
    <ThemedView type="background" style={styles.container}>
      {center && (
        <MapRoute
          coordinates={line.length > 1 ? line : undefined}
          markers={markers}
          initialCenter={center}
          initialZoom={15}
          showUserLocation={false}
          onMapLongPress={(point) => {
            haptics.impactMedium();
            setSnapFailed(false);
            setPlan((current) => addPoint(current, point, { snap: !manual }));
          }}
          dark={resolveMapStyle(stylePref, theme.isDark) === 'dark'}
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
            {manual
              ? 'Manual mode: press and hold the map to add points, joined by straight lines.'
              : 'Press and hold the map to add a point. The route follows roads and paths.'}
          </ThemedText>
        </View>
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
        <ThemedText type="sectionTitle">{formatDistance(distance, unitSystem)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {elevationText}
        </ThemedText>
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
            {/* The sport picks the network the route is snapped to, so it is chosen while drawing. */}
            <ChipRow
              options={SPORTS}
              value={sport}
              onChange={(next) => {
                // Cycling and walking use different networks, so the drawn legs are routed again.
                if (routingProfileFor(next) !== profileName && !manual) setPlan(resnapPlan);
                setSport(next);
              }}
            />
            <View style={styles.snapRow}>
              <ThemedText type="small">Follow roads and paths</ThemedText>
              <AppSwitch
                checked={!manual}
                onChange={(on) => setManual(!on)}
                label="Follow roads and paths. Off draws straight lines (manual mode)"
              />
            </View>
            <View style={styles.tools}>
              <AppButton
                variant="secondary"
                size="small"
                fullWidth={false}
                style={styles.tool}
                disabled={points.length === 0}
                onPress={() =>
                  setPlan((current) => deletePoint(current, current.waypoints.length - 1))
                }
              >
                Undo
              </AppButton>
              <AppButton
                variant="secondary"
                size="small"
                fullWidth={false}
                style={styles.tool}
                disabled={points.length < 2}
                onPress={() => setPlan(reversePlan)}
              >
                Reverse
              </AppButton>
              <AppButton
                variant="secondary"
                size="small"
                fullWidth={false}
                style={styles.tool}
                disabled={points.length === 0}
                onPress={() =>
                  confirmDestructive({
                    title: 'Clear Route',
                    message: `Remove all ${points.length} points from this route?`,
                    confirmLabel: 'Clear Route',
                    onConfirm: () => setPlan(emptyPlan()),
                  })
                }
              >
                Clear
              </AppButton>
            </View>
            <AppButton disabled={points.length < 2} onPress={startSave}>
              Save as route
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
  tools: { flexDirection: 'row', gap: Spacing.two },
  snapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tool: { flex: 1 },
  stack: { gap: Spacing.two },
});
