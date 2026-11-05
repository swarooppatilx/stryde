import { useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityStream, ActivityType } from '@/types';
import { plausibleStreamSpeeds } from '@/utils/activityStream';
import { indexAtX, SCRUB_HOLD_MS } from '@/utils/chartScrub';
import {
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type UnitSystem,
} from '@/utils/format';
import { ThemedText } from './themed-text';

interface Props {
  stream: ActivityStream;
  activityType: ActivityType;
  unitSystem: UnitSystem;
  /** Streams the point under the finger, so the map can move a cursor along the route. */
  onScrubChange?: (index: number | null) => void;
}

const HEIGHT = 96;
const PAD = 4;

function paceChartPaths(
  stream: ActivityStream,
  speed: number[],
  peak: number,
  width: number
): { line: string; area: string } | null {
  const last = stream.t.at(-1) ?? 0;
  if (width === 0 || stream.t.length < 2 || peak <= 0 || last <= 0) return null;
  const innerW = width - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  const points = stream.t.map((t, i) => ({
    x: PAD + (t / last) * innerW,
    y: PAD + innerH - ((speed[i] ?? 0) / peak) * innerH,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const lastX = points.at(-1)?.x ?? PAD;
  const firstX = points[0]?.x ?? PAD;
  return { line, area: `${line} L ${lastX} ${HEIGHT} L ${firstX} ${HEIGHT} Z` };
}

/** Pace (or speed, for a ride) over the length of the recording; faster is higher. */
export function PaceChart({ stream, activityType, unitSystem, onScrubChange }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const speed = plausibleStreamSpeeds(stream.speed, activityType);
  const peak = Math.max(...speed, 0);
  // The point under the athlete's finger while they drag across the chart.
  const [scrubbed, setScrubbed] = useState<number | null>(null);
  const scrubTo = useCallback(
    (x: number) => {
      const index = indexAtX(x, width, PAD, stream.t);
      setScrubbed(index);
      onScrubChange?.(index);
    },
    [width, stream.t, onScrubChange]
  );
  const scrub = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        // A quick swipe belongs to the chart pager and page scroll; holding first starts a scrub.
        .activateAfterLongPress(SCRUB_HOLD_MS)
        .onStart((e) => scrubTo(e.x))
        .onUpdate((e) => scrubTo(e.x))
        .onFinalize(() => {
          setScrubbed(null);
          onScrubChange?.(null);
        }),
    [scrubTo, onScrubChange]
  );

  const paths = paceChartPaths(stream, speed, peak, width);

  if (stream.t.length < 2 || peak <= 0) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const fastest = formatPaceOrSpeed(activityType, peak, 1000, unitSystem);
  const point = scrubbed;
  const last = stream.t.at(-1) ?? 1;
  const cursorX = point === null ? 0 : PAD + ((stream.t[point] ?? 0) / last) * (width - PAD * 2);
  const cursorY =
    point === null
      ? 0
      : PAD + (HEIGHT - PAD * 2) - ((speed[point] ?? 0) / peak) * (HEIGHT - PAD * 2);
  const readout =
    point === null
      ? `Fastest ${fastest}`
      : [
          formatPaceOrSpeed(activityType, speed[point] ?? 0, 1000, unitSystem),
          formatDuration((stream.t[point] ?? 0) * 1000),
          stream.d?.[point] === undefined ? null : formatDistance(stream.d[point], unitSystem),
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{paceOrSpeedLabel(activityType, unitSystem)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {readout}
        </ThemedText>
      </View>
      {paths && (
        <GestureDetector gesture={scrub}>
          <View style={styles.plot}>
            <Svg
              width={width}
              height={HEIGHT}
              accessibilityRole="image"
              accessibilityLabel={`Pace over time, fastest ${fastest}. Drag across it to read a moment.`}
            >
              <Defs>
                <LinearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.brand.primary} stopOpacity={0.3} />
                  <Stop offset="1" stopColor={theme.brand.primary} stopOpacity={0.05} />
                </LinearGradient>
              </Defs>
              <Path d={paths.area} fill="url(#paceFill)" />
              <Path d={paths.line} stroke={theme.brand.primary} strokeWidth={2} fill="none" />
              {point !== null && (
                <>
                  <Line
                    x1={cursorX}
                    x2={cursorX}
                    y1={0}
                    y2={HEIGHT}
                    stroke={theme.textSecondary}
                    strokeWidth={1}
                  />
                  <Circle cx={cursorX} cy={cursorY} r={4} fill={theme.brand.primary} />
                </>
              )}
            </Svg>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  plot: { height: HEIGHT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
