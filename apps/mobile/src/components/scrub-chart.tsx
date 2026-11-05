import { useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { indexAtX, SCRUB_HOLD_MS } from '@/utils/chartScrub';
import { formatDuration } from '@/utils/format';
import { ThemedText } from './themed-text';

interface Props {
  title: string;
  values: readonly number[];
  /** Ascending positions of the values along the chart. */
  times: readonly number[];
  formatValue: (value: number) => string;
  /** What the header reads while nothing is being touched. */
  summary: string;
  /** Set when `times` are seconds, so a touch can read out the moment. */
  timed?: boolean;
  accessibilityLabel: string;
  /** Streams the point under the finger, so the map can move a cursor along the route. */
  onScrubChange?: (index: number | null) => void;
  /** The chart spans at least this much, so a flat line is not blown up into peaks (e.g. metres of climb). */
  minRange?: number;
}

const HEIGHT = 96;
const PAD = 4;

function chartPaths(
  values: readonly number[],
  times: readonly number[],
  range: { min: number; max: number },
  width: number
): { line: string; area: string } | null {
  const last = times.at(-1) ?? 0;
  if (width === 0 || values.length < 2 || last <= 0) return null;
  const span = range.max - range.min || 1;
  const innerW = width - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  const points = values.map((value, i) => ({
    x: PAD + ((times[i] ?? 0) / last) * innerW,
    y: PAD + innerH - ((value - range.min) / span) * innerH,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const lastX = points.at(-1)?.x ?? PAD;
  const firstX = points[0]?.x ?? PAD;
  return { line, area: `${line} L ${lastX} ${HEIGHT} L ${firstX} ${HEIGHT} Z` };
}

/** Any one series over a recording (elevation, heart rate), with the same drag-to-read touch as the pace chart. */
export function ScrubChart({
  title,
  values,
  times,
  formatValue,
  summary,
  timed = false,
  accessibilityLabel,
  onScrubChange,
  minRange = 0,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [scrubbed, setScrubbed] = useState<number | null>(null);
  const scrubTo = useCallback(
    (x: number) => {
      const index = indexAtX(x, width, PAD, times);
      setScrubbed(index);
      onScrubChange?.(index);
    },
    [width, times, onScrubChange]
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

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const widen = Math.max(0, minRange - (highest - lowest)) / 2;
  const min = lowest - widen;
  const max = highest + widen;
  const paths = chartPaths(values, times, { min, max }, width);
  const last = times.at(-1) ?? 1;
  const span = max - min || 1;
  const value = scrubbed === null ? undefined : values[scrubbed];
  const cursorX = scrubbed === null ? 0 : PAD + ((times[scrubbed] ?? 0) / last) * (width - PAD * 2);
  const cursorY =
    value === undefined
      ? 0
      : PAD + (HEIGHT - PAD * 2) - ((value - min) / span) * (HEIGHT - PAD * 2);
  const readout =
    scrubbed === null || value === undefined
      ? summary
      : [formatValue(value), timed ? formatDuration((times[scrubbed] ?? 0) * 1000) : null]
          .filter(Boolean)
          .join(' · ');

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.header}>
        <ThemedText type="sectionTitle">{title}</ThemedText>
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
              accessibilityLabel={accessibilityLabel}
            >
              <Defs>
                <LinearGradient id="scrubFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.brand.primary} stopOpacity={0.3} />
                  <Stop offset="1" stopColor={theme.brand.primary} stopOpacity={0.05} />
                </LinearGradient>
              </Defs>
              <Path d={paths.area} fill="url(#scrubFill)" />
              <Path d={paths.line} stroke={theme.brand.primary} strokeWidth={2} fill="none" />
              {scrubbed !== null && (
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
