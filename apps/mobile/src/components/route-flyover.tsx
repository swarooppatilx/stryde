import { Ionicons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { MapChrome } from '@/constants/mapChrome';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import {
  FLYOVER_SPEEDS,
  flyoverDurationMs,
  flyoverFrames,
  flyoverProgress,
  frameAt,
  nextFlyoverSpeed,
} from '@/utils/flyover';
import { formatDistance } from '@/utils/format';

const FRAME_COUNT = 240;
const TICK_MS = 33;
/** The screen's progress readout refreshes every few camera moves: the camera needs 30 a second, the text does not. */
const READOUT_EVERY = 4;
const PITCH = 60;
const ZOOM = 16;

interface Props {
  line: [number, number][];
  title: string;
  dark: boolean;
  onClose(): void;
}

/** A camera that flies along the route on a tilted map: play, pause, 1x/2x/4x, and a progress bar. */
export function RouteFlyover({ line, title, dark, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const unitSystem = useUnitSystem();
  const cameraRef = useRef<CameraRef | null>(null);
  const frames = useMemo(() => flyoverFrames(line, FRAME_COUNT), [line]);
  const total = frames.at(-1)?.distance ?? 0;

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(FLYOVER_SPEEDS[0]);
  const [progress, setProgress] = useState(0);
  // The flight runs on refs so a tick never waits for a render; state only feeds the readout.
  const progressRef = useRef(0);
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    let last = Date.now();
    let ticks = 0;
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      const duration = flyoverDurationMs(total, speedRef.current);
      progressRef.current = flyoverProgress(progressRef.current, elapsed, duration);
      const frame = frameAt(frames, progressRef.current);
      if (frame) {
        cameraRef.current?.jumpTo({
          center: frame.center,
          bearing: frame.bearing,
          pitch: PITCH,
          zoom: ZOOM,
        });
      }
      ticks += 1;
      const done = progressRef.current >= 1;
      if (done || ticks % READOUT_EVERY === 0) setProgress(progressRef.current);
      if (done) setPlaying(false);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, frames, total]);

  const frame = frameAt(frames, progress);
  const finished = progress >= 1;
  const markers: MapMarker[] = frame
    ? [{ id: 'flyover', coordinate: frame.center, color: theme.brand.primary, icon: 'ellipse' }]
    : [];

  const playControl = finished
    ? ({ icon: 'refresh', label: 'Replay flyover' } as const)
    : ({
        icon: playing ? 'pause' : 'play',
        label: playing ? 'Pause flyover' : 'Play flyover',
      } as const);

  const restart = () => {
    progressRef.current = 0;
    setProgress(0);
    setPlaying(true);
  };

  return (
    <View style={styles.container}>
      <MapRoute
        coordinates={line}
        markers={markers}
        initialCenter={line[0]}
        initialZoom={ZOOM}
        cameraRef={cameraRef}
        showUserLocation={false}
        dark={dark}
        compassTopOffset={insets.top + MapChrome.edge + 56}
      />
      <View style={[styles.top, { top: insets.top + MapChrome.edge }]}>
        <Tappable
          onPress={onClose}
          style={[styles.round, theme.shadows.raised, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="button"
          accessibilityLabel="Close flyover"
        >
          <Ionicons name="close" size={24} color={theme.text} />
        </Tappable>
        <View
          style={[styles.title, theme.shadows.raised, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="smallBold" numberOfLines={1}>
            {title}
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
        <ThemedText type="sectionTitle" accessibilityLiveRegion="polite">
          {formatDistance(frame?.distance ?? 0, unitSystem)}
          <ThemedText type="small" themeColor="textSecondary">
            {`  of ${formatDistance(total, unitSystem)}`}
          </ThemedText>
        </ThemedText>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.brand.primary },
            ]}
          />
        </View>
        <View style={styles.controls}>
          <Tappable
            onPress={finished ? restart : () => setPlaying((p) => !p)}
            style={[styles.play, { backgroundColor: theme.brand.primary }]}
            accessibilityRole="button"
            accessibilityLabel={playControl.label}
          >
            <Ionicons name={playControl.icon} size={28} color={theme.brand.white} />
          </Tappable>
          <Tappable
            onPress={() => setSpeed(nextFlyoverSpeed)}
            style={[styles.speed, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Speed ${speed}x. Tap to change`}
          >
            <ThemedText type="smallBold">{`${speed}x`}</ThemedText>
          </Tappable>
        </View>
      </View>
    </View>
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
  title: {
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
    gap: Spacing.three,
    padding: Spacing.four,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  track: { height: 6, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill: { height: 6, borderRadius: BorderRadius.full },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  play: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speed: {
    minWidth: 64,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
