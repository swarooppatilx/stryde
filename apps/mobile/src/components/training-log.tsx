import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Activity } from '@/types';
import { formatDay, formatMonthYear } from '@/utils/dates';
import { formatDistance, formatDuration, SPORT_LABEL, type UnitSystem } from '@/utils/format';
import { sportsDone } from '@/utils/periodStats';
import { countOf } from '@/utils/plural';
import {
  CHART_RANGES,
  type ChartRange,
  chartBuckets,
  sportBreakdown,
} from '@/utils/progressRanges';
import {
  filterBySport,
  monthCalendar,
  periodTotals,
  type Totals,
  type WeekStartDay,
  weekdayLabels,
} from '@/utils/trainingLog';
import { METRIC_OPTIONS, metricText, metricValue, type WeekMetric } from '@/utils/weekMetric';
import { Card } from './card';
import { ChipRow } from './filter-chips';
import { SegmentedChoice } from './segmented-choice';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const CHART_HEIGHT = 96;

function TotalsBlock({
  title,
  totals,
  unitSystem,
}: {
  title: string;
  totals: Totals;
  unitSystem: UnitSystem;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.totalsBlock}>
      <ThemedText type="caption" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText style={[styles.totalsValue, { color: theme.text }]}>
        {formatDistance(totals.distance, unitSystem)}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {countOf(totals.count, 'activity', 'activities')} · {formatDuration(totals.duration)}
      </ThemedText>
    </ThemedView>
  );
}

/** Distance, time or activities per week, day or month for the chosen range; the current bar is highlighted. */
function RangeChart({
  activities,
  unitSystem,
  now,
  startsOn,
}: {
  activities: readonly Activity[];
  unitSystem: UnitSystem;
  now: Date;
  startsOn: WeekStartDay;
}) {
  const theme = useTheme();
  const [metric, setMetric] = useState<WeekMetric>('distance');
  const [range, setRange] = useState<ChartRange>('weeks');
  const view = chartBuckets(activities, range, now, startsOn);
  const tallest = Math.max(...view.buckets.map((b) => metricValue(b, metric)), 1);
  const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)?.label.toLowerCase();
  const dense = range === 'month';

  return (
    <>
      <SegmentedChoice<WeekMetric>
        options={METRIC_OPTIONS}
        selected={metric}
        onSelect={setMetric}
        fill
      />
      <SegmentedChoice<ChartRange>
        options={CHART_RANGES}
        selected={range}
        onSelect={setRange}
        fill
      />
      <View
        style={[styles.chart, dense && styles.chartDense]}
        accessibilityRole="image"
        accessibilityLabel={`${metricLabel} per ${view.unit}, ${view.span}`}
      >
        {view.buckets.map((bucket, index) => {
          const isCurrent = index === view.currentIndex;
          const value = metricValue(bucket, metric);
          const height = value > 0 ? Math.max(4, (value / tallest) * CHART_HEIGHT) : 2;
          return (
            <View
              key={bucket.start.getTime()}
              style={styles.chartColumn}
              accessible
              accessibilityLabel={`${view.unit === 'week' ? 'Week of ' : ''}${formatDay(bucket.start)}: ${metricText(value, metric, unitSystem)}`}
            >
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {isCurrent && value > 0 && !dense ? metricText(value, metric, unitSystem) : ' '}
              </ThemedText>
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: isCurrent ? theme.brand.primary : theme.backgroundSelected,
                    },
                  ]}
                />
              </View>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                numberOfLines={1}
                style={styles.barLabel}
              >
                {view.label(index) || ' '}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <SportBreakdown
        activities={activities}
        range={range}
        now={now}
        startsOn={startsOn}
        unitSystem={unitSystem}
      />
    </>
  );
}

/** What each sport added over the chart's range, as bars scaled to the biggest. */
function SportBreakdown({
  activities,
  range,
  now,
  startsOn,
  unitSystem,
}: {
  activities: readonly Activity[];
  range: ChartRange;
  now: Date;
  startsOn: WeekStartDay;
  unitSystem: UnitSystem;
}) {
  const theme = useTheme();
  const rows = sportBreakdown(activities, range, now, startsOn);
  if (rows.length < 2) return null;
  return (
    <ThemedView style={styles.breakdown}>
      <ThemedText type="caption" themeColor="textSecondary">
        By sport
      </ThemedText>
      {rows.map((row) => (
        <ThemedView
          key={row.sport}
          style={styles.breakdownRow}
          accessible
          accessibilityLabel={`${SPORT_LABEL[row.sport] ?? row.sport}: ${formatDistance(row.distance, unitSystem)}, ${countOf(row.count, 'activity', 'activities')}`}
        >
          <ThemedView style={styles.breakdownText}>
            <ThemedText type="small">{SPORT_LABEL[row.sport] ?? row.sport}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDistance(row.distance, unitSystem)} ·{' '}
              {countOf(row.count, 'activity', 'activities')}
            </ThemedText>
          </ThemedView>
          <ThemedView style={[styles.share, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedView
              style={[
                styles.shareFill,
                { width: `${row.share * 100}%`, backgroundColor: theme.brand.primary },
              ]}
            />
          </ThemedView>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

/** A month at a glance, from the week's first day; tap a day to see what was done on it. */
function MonthCalendar({
  activities,
  unitSystem,
  now,
  startsOn,
}: {
  activities: readonly Activity[];
  unitSystem: UnitSystem;
  now: Date;
  startsOn: WeekStartDay;
}) {
  const theme = useTheme();
  const [monthsBack, setMonthsBack] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const shown = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const { weeks } = monthCalendar(activities, shown.getFullYear(), shown.getMonth(), startsOn);
  const longest = Math.max(...weeks.flat().map((cell) => cell?.distance ?? 0), 1);
  const picked = weeks.flat().find((cell) => cell?.day === selected) ?? null;

  const go = (delta: number) => {
    setMonthsBack((value) => Math.max(0, value + delta));
    setSelected(null);
  };

  return (
    <ThemedView style={styles.calendar}>
      <ThemedView style={styles.calendarHeader}>
        <Tappable
          onPress={() => go(1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </Tappable>
        <ThemedText type="smallBold">{formatMonthYear(shown)}</ThemedText>
        <Tappable
          onPress={() => go(-1)}
          disabled={monthsBack === 0}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: monthsBack === 0 }}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={monthsBack === 0 ? theme.border : theme.text}
          />
        </Tappable>
      </ThemedView>

      <ThemedView style={styles.weekRow}>
        {weekdayLabels(startsOn).map((label, i) => (
          <ThemedText
            key={`${label}${i}`}
            type="caption"
            themeColor="textSecondary"
            style={styles.cell}
          >
            {label}
          </ThemedText>
        ))}
      </ThemedView>

      {weeks.map((week) => (
        <ThemedView key={week.map((c) => c?.day ?? 'x').join('-')} style={styles.weekRow}>
          {week.map((cell, i) =>
            cell === null ? (
              <View key={`blank-${i}`} style={styles.cell} />
            ) : (
              <Tappable
                key={cell.day}
                style={styles.cell}
                disabled={cell.count === 0}
                onPress={() => setSelected(cell.day === selected ? null : cell.day)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDay(new Date(shown.getFullYear(), shown.getMonth(), cell.day))}: ${
                  cell.count === 0
                    ? 'no activity'
                    : `${countOf(cell.count, 'activity', 'activities')}, ${formatDistance(cell.distance, unitSystem)}`
                }`}
              >
                <View
                  style={[
                    styles.day,
                    cell.count > 0 && {
                      backgroundColor: theme.brand.primary,
                      // Longer days read darker, so a heavy week stands out at a glance.
                      opacity: 0.35 + 0.65 * (cell.distance / longest),
                    },
                    cell.day === selected && { borderWidth: 2, borderColor: theme.text },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: cell.count > 0 ? Palette.white : theme.textSecondary }}
                  >
                    {cell.day}
                  </ThemedText>
                </View>
              </Tappable>
            )
          )}
        </ThemedView>
      ))}

      {picked && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.picked}>
          {formatDay(new Date(shown.getFullYear(), shown.getMonth(), picked.day))} ·{' '}
          {countOf(picked.count, 'activity', 'activities')} ·{' '}
          {formatDistance(picked.distance, unitSystem)}
        </ThemedText>
      )}
    </ThemedView>
  );
}

/** Training log: month and year totals, a weekly distance chart, and a month calendar. */
export function TrainingLog({
  activities,
  unitSystem,
}: {
  activities: readonly Activity[];
  unitSystem: UnitSystem;
}) {
  const now = new Date();
  const startsOn = useSettingsStore((s) => s.weekStartsOn);
  const [sport, setSport] = useState('all');
  const sports = sportsDone(activities as Activity[]);
  const options = [
    { value: 'all', label: 'All' },
    ...sports.map((type) => ({ value: type as string, label: SPORT_LABEL[type] ?? type })),
  ];
  // A sport that no longer has activities (the list changed) falls back to everything.
  const chosen = sports.includes(sport as never) ? sport : 'all';
  const shown = filterBySport(activities, chosen);
  const totals = periodTotals(shown, now);

  return (
    <Card style={styles.card}>
      <ThemedText type="sectionTitle">Training Log</ThemedText>
      {sports.length > 1 ? <ChipRow options={options} value={chosen} onChange={setSport} /> : null}
      <ThemedView style={styles.totalsRow}>
        <TotalsBlock title="This month" totals={totals.month} unitSystem={unitSystem} />
        <TotalsBlock title="This year" totals={totals.year} unitSystem={unitSystem} />
      </ThemedView>
      <RangeChart activities={shown} unitSystem={unitSystem} now={now} startsOn={startsOn} />
      <MonthCalendar activities={shown} unitSystem={unitSystem} now={now} startsOn={startsOn} />
    </Card>
  );
}

const CELL = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  totalsRow: { flexDirection: 'row', gap: Spacing.three },
  totalsBlock: { flex: 1, gap: Spacing.half },
  totalsValue: textStyle(TypeScale.headline),
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one },
  chartDense: { gap: Spacing.half },
  barLabel: { height: 16, width: 28, textAlign: 'center' },
  breakdown: { gap: Spacing.two },
  breakdownRow: { gap: Spacing.one },
  breakdownText: { flexDirection: 'row', justifyContent: 'space-between' },
  share: { height: 4, borderRadius: BorderRadius.full, overflow: 'hidden' },
  shareFill: { height: 4, borderRadius: BorderRadius.full },
  chartColumn: { flex: 1, alignItems: 'center', gap: Spacing.half },
  barSlot: { height: CHART_HEIGHT, justifyContent: 'flex-end', alignSelf: 'stretch' },
  bar: { width: '100%', borderRadius: BorderRadius.sm },
  calendar: { gap: Spacing.one },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekRow: { flexDirection: 'row' },
  cell: { width: CELL, alignItems: 'center', textAlign: 'center', paddingVertical: Spacing.half },
  day: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picked: { paddingTop: Spacing.one },
});
