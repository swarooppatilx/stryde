import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipRow } from '@/components/filter-chips';
import type { MapCamera } from '@/components/map-camera';
import { MapRoute } from '@/components/map-route';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { TERRAIN_PITCH } from '@/constants/mapboxStyle';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import type { ActivityType } from '@/types';
import {
  elevationAtShare,
  flyoverDurationMs,
  flyoverFrames,
  flyoverZoom,
  gradeAt,
  lineLength,
} from '@/utils/activityFlyover';
import { formatDistance, formatElevation, formatPaceOrSpeed, showsSpeed } from '@/utils/format';
import type { RoutePoint } from '@/utils/route';

const FRAME_COUNT = 160;
/** Steeper than the map's own 3D tilt, for the low, over-the-shoulder look. */
const FLYOVER_PITCH = Math.max(TERRAIN_PITCH, 65);
/** A beat on the opening view before the camera sets off. */
const START_DELAY_MS = 900;
const SPEEDS = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
];

interface ActivityFlyoverProps {
  visible: boolean;
  coordinates: readonly RoutePoint[];
  title?: string;
  /** Ground height sampled evenly along the route, for elevation and gradient during the replay. */
  elevations?: readonly number[];
  /** Sport and moving time, for the average pace (or speed, for a ride). */
  activityType?: ActivityType;
  movingTimeMs?: number;
  /** The activity's recorded distance; the average uses it so it matches the activity page. */
  distanceM?: number;
  onClose(): void;
}

/** The activity replayed as a 3D flight over the terrain, the line drawing itself behind you. */
export function ActivityFlyover({
  visible,
  coordinates,
  title,
  elevations,
  activityType,
  movingTimeMs,
  distanceM,
  onClose,
}: ActivityFlyoverProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<MapCamera>(null);
  const frames = useMemo(() => flyoverFrames(coordinates, FRAME_COUNT), [coordinates]);
  const total = useMemo(() => lineLength(coordinates), [coordinates]);
  const zoom = flyoverZoom(total);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [speed, setSpeed] = useState('1');

  // Every opening starts from the beginning.
  useEffect(() => {
    if (!visible) {
      setReady(false);
      setPlaying(false);
      setFrame(0);
    }
  }, [visible]);

  // Opening view, then off it goes.
  useEffect(() => {
    if (!ready) return;
    const first = frames[0];
    if (!first) return;
    cameraRef.current?.easeTo({
      center: first.center,
      bearing: first.bearing,
      pitch: FLYOVER_PITCH,
      zoom,
    });
    const timer = setTimeout(() => setPlaying(true), START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, frames, zoom]);

  // One camera move per frame, each as long as the gap to the next, so the flight never stops.
  useEffect(() => {
    if (!playing || !ready) return;
    const next = frames[frame + 1];
    if (!next) {
      setPlaying(false);
      return;
    }
    const stepMs = flyoverDurationMs(total, Number(speed)) / frames.length;
    cameraRef.current?.easeTo({
      center: next.center,
      bearing: next.bearing,
      pitch: FLYOVER_PITCH,
      zoom,
      duration: stepMs,
      linear: true,
    });
    const timer = setTimeout(() => setFrame((f) => f + 1), stepMs);
    return () => clearTimeout(timer);
  }, [playing, ready, frame, frames, speed, total, zoom]);

  const current = frames[frame];
  const drawn = useMemo<RoutePoint[]>(
    () => (current ? [...coordinates.slice(0, current.index + 1), current.center] : []),
    [coordinates, current]
  );
  const finished = frame >= frames.length - 1;
  const unitSystem = useUnitSystem();
  const [showStats, setShowStats] = useState(true);
  const doneM = current?.distanceM ?? 0;
  const share = total > 0 ? doneM / total : 0;
  const elevationNow = elevations?.length ? elevationAtShare(elevations, share) : null;
  const gradeNow = elevations?.length ? gradeAt(elevations, total, doneM) : null;
  const average =
    activityType && movingTimeMs
      ? formatPaceOrSpeed(activityType, distanceM ?? total, movingTimeMs, unitSystem)
      : null;
  const stats: Array<{ label: string; value: string }> = [
    {
      label: 'Distance',
      value: `${formatDistance(doneM, unitSystem)} / ${formatDistance(total, unitSystem)}`,
    },
  ];
  if (elevationNow !== null) {
    stats.push({ label: 'Elevation', value: formatElevation(elevationNow, unitSystem) });
  }
  if (gradeNow !== null) stats.push({ label: 'Gradient', value: `${gradeNow.toFixed(1)}%` });
  if (average && activityType) {
    stats.push({ label: showsSpeed(activityType) ? 'Avg speed' : 'Avg pace', value: average });
  }
  /** Brings the camera back over the current spot after the athlete has moved the map. */
  const recenter = () => {
    const at = frames[frame];
    if (at) {
      cameraRef.current?.easeTo({
        center: at.center,
        bearing: at.bearing,
        pitch: FLYOVER_PITCH,
        zoom,
        duration: 500,
      });
    }
  };

  const restart = () => {
    setFrame(0);
    const first = frames[0];
    if (first) {
      cameraRef.current?.easeTo({
        center: first.center,
        bearing: first.bearing,
        pitch: FLYOVER_PITCH,
        zoom,
        duration: 600,
      });
    }
    setPlaying(true);
  };
  const start = coordinates[0];
  const playControl = (() => {
    if (finished) return { label: 'Replay', icon: 'refresh' as const };
    return playing
      ? { label: 'Pause', icon: 'pause' as const }
      : { label: 'Play', icon: 'play' as const };
  })();

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {start && (
          <MapRoute
            cameraRef={cameraRef}
            coordinates={drawn.length > 1 ? drawn : undefined}
            markers={[
              { id: 'start', coordinate: start, color: theme.brand.success, icon: 'play' },
              ...(current
                ? [
                    {
                      id: 'now',
                      coordinate: current.center,
                      color: theme.brand.primary,
                      icon: 'navigate',
                    },
                  ]
                : []),
            ]}
            initialCenter={start}
            initialZoom={zoom}
            showUserLocation={false}
            mapType="hybrid"
            terrain3d
            dark
            compassTopOffset={insets.top + 72}
            onMapReady={() => setReady(true)}
          />
        )}

        <View style={[styles.top, { top: insets.top + Spacing.three }]}>
          <Tappable
            onPress={onClose}
            style={[styles.round, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel="Close the 3D flyover"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Tappable>
          {title ? (
            <View style={[styles.title, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {title}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {showStats && (
          <View
            style={[styles.stats, { top: insets.top + Spacing.three + 60 }]}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
          >
            {stats.map((stat) => (
              <View key={stat.label}>
                <ThemedText type="caption" style={styles.statLabel}>
                  {stat.label}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.statValue}>
                  {stat.value}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        <View
          style={[
            styles.controls,
            theme.shadows.sheet,
            {
              backgroundColor: theme.backgroundElement,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}
        >
          <View
            style={[styles.track, { backgroundColor: theme.background }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: frames.length - 1, now: frame }}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${frames.length > 1 ? (frame / (frames.length - 1)) * 100 : 0}%`,
                  backgroundColor: theme.brand.primary,
                },
              ]}
            />
          </View>
          <View style={styles.row}>
            <Tappable
              onPress={() => (finished ? restart() : setPlaying((p) => !p))}
              style={[styles.play, { backgroundColor: theme.brand.primary }]}
              accessibilityRole="button"
              accessibilityLabel={playControl.label}
            >
              <Ionicons name={playControl.icon} size={26} color={Palette.white} />
            </Tappable>
            <Tappable
              onPress={restart}
              style={styles.restart}
              accessibilityRole="button"
              accessibilityLabel="Start again"
            >
              <Ionicons name="play-skip-back" size={22} color={theme.text} />
            </Tappable>
            <ChipRow
              options={SPEEDS}
              value={speed}
              onChange={setSpeed}
              contentStyle={styles.speeds}
            />
          </View>
          <View style={styles.row}>
            <Tappable
              onPress={() => setShowStats((s) => !s)}
              style={styles.toggle}
              accessibilityRole="switch"
              accessibilityState={{ checked: showStats }}
              accessibilityLabel="Show statistics"
            >
              <Ionicons
                name="stats-chart-outline"
                size={18}
                color={showStats ? theme.brand.primary : theme.textSecondary}
              />
              <ThemedText
                type="smallBold"
                style={{ color: showStats ? theme.brand.primary : theme.textSecondary }}
              >
                Stats
              </ThemedText>
            </Tappable>
            <Tappable
              onPress={recenter}
              style={styles.toggle}
              accessibilityRole="button"
              accessibilityLabel="Re-center the camera on the route"
            >
              <Ionicons name="locate-outline" size={18} color={theme.text} />
              <ThemedText type="smallBold">Re-center</ThemedText>
            </Tappable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.black },
  top: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  play: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restart: { padding: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, padding: Spacing.two },
  stats: {
    position: 'absolute',
    left: Spacing.three,
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    backgroundColor: tint(Palette.black, 0.55),
  },
  statLabel: { color: Palette.white, opacity: 0.75 },
  statValue: { color: Palette.white },
  speeds: { paddingHorizontal: 0 },
});
