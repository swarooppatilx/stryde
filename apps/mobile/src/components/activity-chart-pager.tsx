import { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FlatCard } from '@/components/activity-detail/analysis-card';
import { PaceChart } from '@/components/pace-chart';
import { ScrubChart } from '@/components/scrub-chart';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityStream, ActivityType } from '@/types';
import {
  type ChartPage,
  chartPages,
  elevationScrubTarget,
  elevationSeries,
  heartRateScrubTarget,
} from '@/utils/chartPages';
import { formatElevation, type UnitSystem } from '@/utils/format';

interface Props {
  stream: ActivityStream | undefined;
  /** The elevation lookup along the route, used when the recording carries no altitude. */
  elevations?: readonly number[];
  activityType: ActivityType;
  unitSystem: UnitSystem;
  /** The stream point under the finger on whichever chart is touched, so the map can mark it. */
  onScrubChange: (streamIndex: number | null) => void;
}

const DOT = 8;

const PAGE_LABEL: Record<ChartPage, string> = {
  pace: 'Pace',
  elevation: 'Elevation',
  heartRate: 'Heart rate',
};

/** Pace, elevation and heart rate as swipeable cards with page dots; a page appears only when there is data for it. */
export function ActivityChartPager({
  stream,
  elevations,
  activityType,
  unitSystem,
  onScrubChange,
}: Props) {
  const theme = useTheme();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const pages = chartPages({ stream, elevations, activityType });
  const elevation = elevationSeries(stream, elevations);
  const heartRate = stream?.heartRate;

  if (pages.length === 0) return null;

  const renderPage = (kind: ChartPage) => {
    if (kind === 'pace' && stream) {
      return (
        <PaceChart
          stream={stream}
          activityType={activityType}
          unitSystem={unitSystem}
          onScrubChange={onScrubChange}
        />
      );
    }
    if (kind === 'elevation' && elevation) {
      const low = Math.min(...elevation.values);
      const high = Math.max(...elevation.values);
      return (
        <ScrubChart
          title="Elevation"
          minSpan={20}
          values={elevation.values}
          times={elevation.times}
          timed={elevation.source === 'stream'}
          formatValue={(v) => formatElevation(v, unitSystem)}
          summary={`${formatElevation(low, unitSystem)} to ${formatElevation(high, unitSystem)}`}
          accessibilityLabel={`Elevation over the route, ${formatElevation(low, unitSystem)} to ${formatElevation(high, unitSystem)}. Drag across it to read a point.`}
          onScrubChange={(i) => onScrubChange(elevationScrubTarget(elevation, i, stream))}
        />
      );
    }
    if (kind === 'heartRate' && heartRate) {
      const peak = Math.max(...heartRate.bpm);
      return (
        <ScrubChart
          title="Heart rate"
          minSpan={30}
          values={heartRate.bpm}
          times={heartRate.t}
          timed
          formatValue={(v) => `${Math.round(v)} bpm`}
          summary={`Peak ${Math.round(peak)} bpm`}
          accessibilityLabel={`Heart rate over time, peak ${Math.round(peak)} beats per minute. Drag across it to read a moment.`}
          onScrubChange={(i) => onScrubChange(heartRateScrubTarget(stream, i))}
        />
      );
    }
    return null;
  };

  if (pages.length === 1) return <FlatCard>{renderPage(pages[0] as ChartPage)}</FlatCard>;

  const goTo = (index: number) => {
    scroller.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  return (
    <FlatCard>
      <View
        style={styles.container}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            width > 0 && setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {pages.map((kind) => (
            <View key={kind} style={{ width }}>
              {renderPage(kind)}
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots} accessibilityRole="tablist">
          {pages.map((kind, index) => (
            <Tappable
              key={kind}
              onPress={() => goTo(index)}
              hitSlop={12}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === page }}
              accessibilityLabel={`${PAGE_LABEL[kind]} chart`}
              style={[
                styles.dot,
                { backgroundColor: index === page ? theme.brand.primary : theme.border },
              ]}
            />
          ))}
        </View>
      </View>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { width: DOT, height: DOT, borderRadius: BorderRadius.full },
});
