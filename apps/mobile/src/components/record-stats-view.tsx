import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Brand, IconSize, Spacing, Touch } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useLiveStatLayout } from '@/hooks/useLiveStatLayout';
import { useVerticalSwipe } from '@/hooks/useVerticalSwipe';
import type { ActivityType, Lap } from '@/types';
import type { UnitSystem } from '@/utils/format';
import { lapRows, type StretchRow, splitRows } from '@/utils/liveRows';
import { LIVE_STAT_FIELDS, type LiveStatData, type LiveStatId } from '@/utils/liveStats';
import { ActionSheet, type SheetAction } from './action-sheet';
import { LapCompleteCard, PausedBar } from './record-banners';
import { EditableStat } from './record-stats';
import { ThemedText } from './themed-text';

const PAGES = ['Stats', 'Laps'] as const;
/** The big figure takes slot 0; the next slots, minus any with no data, sit around it. */
const MAX_SUPPORTING = 4;

interface RecordStatsViewProps {
  activityType: ActivityType;
  unitSystem: UnitSystem;
  data: LiveStatData;
  /** Null while recording. */
  paused: { auto: boolean } | null;
  lapCard: Lap | null;
  onShrink(): void;
  /** Pause, lap, finish: the same controls the sheet carries. */
  controls: ReactNode;
}

/** Stats at a glance: one very large figure with a few beside it, and a second page of laps and splits. */
export function RecordStatsView({
  activityType,
  unitSystem,
  data,
  paused,
  lapCard,
  onShrink,
  controls,
}: RecordStatsViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { layout, choices, choose } = useLiveStatLayout(activityType);
  const [editing, setEditing] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const swipe = useVerticalSwipe(
    useCallback(
      (direction: 'up' | 'down') => {
        if (direction === 'down') onShrink();
      },
      [onShrink]
    ),
    { distance: 40, velocity: 600 }
  );

  const onPagerLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };
  const goTo = (next: number) => {
    setPage(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  const current = editing === null ? undefined : layout[editing];
  const actions: SheetAction[] = choices.map((field) => ({
    label: field.name,
    icon: field.id === current ? 'checkmark' : field.icon,
    onPress: () => editing !== null && choose(editing, field.id),
  }));

  const cell = (id: LiveStatId, slot: number) => {
    const field = LIVE_STAT_FIELDS[id];
    return {
      slot,
      id,
      name: field.name,
      value: field.value(data, unitSystem),
      label: field.label(unitSystem),
      good: field.tone?.(data) === 'success',
    };
  };
  const primaryId = layout[0];
  const primary = primaryId ? cell(primaryId, 0) : null;
  const supporting = layout
    .map((id, slot) => ({ id, slot }))
    .slice(1)
    .filter(({ id }) => LIVE_STAT_FIELDS[id].available?.(data) !== false)
    .slice(0, MAX_SUPPORTING)
    .map(({ id, slot }) => cell(id, slot));

  const average = { distance: data.distance, duration: data.duration };
  const laps = lapRows(data.laps, data.currentLap, activityType, average, unitSystem);
  const splits = splitRows(data.splits, activityType, average, unitSystem);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + Spacing.three,
        },
      ]}
    >
      <GestureDetector gesture={swipe}>
        <View style={styles.header}>
          <ThemedText type="display" accessibilityRole="header">
            {PAGES[page]}
          </ThemedText>
          <Pressable
            onPress={onShrink}
            style={styles.shrink}
            accessibilityRole="button"
            accessibilityLabel="Shrink to map"
          >
            <Ionicons name="contract" size={IconSize.inline} color={Brand.primary} />
            <ThemedText type="linkPrimary">Shrink</ThemedText>
          </Pressable>
        </View>
      </GestureDetector>

      <View style={styles.banners}>
        {paused && <PausedBar autoPaused={paused.auto} />}
        {lapCard && (
          <LapCompleteCard lap={lapCard} activityType={activityType} unitSystem={unitSystem} />
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={onPagerLayout}
        onMomentumScrollEnd={onSettle}
        style={styles.pager}
      >
        <View style={[styles.page, { width }]}>
          {primary && (
            <EditableStat
              slot={primary.slot}
              name={primary.name}
              onEdit={setEditing}
              style={styles.primary}
            >
              <ThemedText
                type="stat"
                themeColor={primary.good ? 'successText' : undefined}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={styles.primaryValue}
              >
                {primary.value}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {primary.label}
              </ThemedText>
            </EditableStat>
          )}
          <View style={styles.grid}>
            {supporting.map((stat) => (
              <EditableStat
                key={stat.slot}
                slot={stat.slot}
                name={stat.name}
                onEdit={setEditing}
                style={[styles.cell, { borderColor: theme.border }]}
              >
                <ThemedText
                  type="display"
                  themeColor={stat.good ? 'successText' : undefined}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {stat.value}
                </ThemedText>
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  numberOfLines={2}
                  style={styles.cellLabel}
                >
                  {stat.label}
                </ThemedText>
              </EditableStat>
            ))}
          </View>
        </View>

        <ScrollView style={{ width }} contentContainerStyle={styles.laps}>
          <RowSection title="Laps" empty="No laps yet. Press Lap to mark one." rows={laps} />
          <RowSection
            title={unitSystem === 'imperial' ? 'Miles' : 'Kilometres'}
            empty="Your first split appears when you finish one."
            rows={splits}
          />
        </ScrollView>
      </ScrollView>

      <View style={styles.dots} accessibilityRole="tablist">
        {PAGES.map((name, index) => (
          <Pressable
            key={name}
            onPress={() => goTo(index)}
            style={styles.dotTarget}
            accessibilityRole="tab"
            accessibilityLabel={`${name} page`}
            accessibilityState={{ selected: page === index }}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: page === index ? Brand.primary : theme.borderBold },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {controls}

      <ActionSheet
        visible={editing !== null}
        title="Change stat"
        actions={actions}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

function RowSection({ title, empty, rows }: { title: string; empty: string; rows: StretchRow[] }) {
  const theme = useTheme();
  return (
    <View style={styles.section} accessibilityLabel={title}>
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        {title}
      </ThemedText>
      {rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        rows.map((row) => (
          <View
            key={row.key}
            style={[styles.row, { borderBottomColor: theme.border }]}
            accessible
            accessibilityLabel={`${row.label}${row.running ? ', running' : ''}. ${row.time}. ${row.pace}.${row.versus ? ` ${row.versus.text} against your average.` : ''}`}
          >
            <ThemedText type="smallBold" style={styles.rowLabel}>
              {row.label}
            </ThemedText>
            <ThemedText type="small" style={styles.rowTime}>
              {row.time}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.rowPace}>
              {row.pace}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={row.versus?.faster ? 'successText' : 'textSecondary'}
              style={styles.rowVersus}
            >
              {row.versus?.text ?? '—'}
            </ThemedText>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, paddingHorizontal: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shrink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Touch.target,
    paddingHorizontal: Spacing.two,
  },
  banners: { gap: Spacing.two },
  pager: { flex: 1, marginHorizontal: -Spacing.four },
  page: { paddingHorizontal: Spacing.four, justifyContent: 'center', gap: Spacing.four },
  primary: { alignItems: 'center', gap: Spacing.one },
  primaryValue: {
    ...textStyle(TypeScale.countdown),
    fontVariant: ['tabular-nums'],
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.four,
  },
  cellLabel: { textAlign: 'center' },
  cell: {
    width: '48%',
    alignItems: 'center',
    gap: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
  },
  laps: { paddingHorizontal: Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1.2 },
  rowTime: { flex: 1, textAlign: 'right' },
  rowPace: { flex: 1.3, textAlign: 'right' },
  rowVersus: { flex: 1, textAlign: 'right' },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dotTarget: {
    minWidth: Touch.target,
    minHeight: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: Spacing.two, height: Spacing.two, borderRadius: BorderRadius.full },
});
