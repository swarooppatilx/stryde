import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, memo, type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Brand, IconSize, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveStatLayout } from '@/hooks/useLiveStatLayout';
import type { ActivityType } from '@/types';
import { formatPaceOrSpeed, type UnitSystem } from '@/utils/format';
import { lapSummary } from '@/utils/laps';
import {
  LIVE_STAT_FIELDS,
  type LiveStatData,
  type LiveStatId,
  PRIMARY_LIVE_STAT_SLOTS,
} from '@/utils/liveStats';
import { ActionSheet, type SheetAction } from './action-sheet';
import { ThemedText } from './themed-text';

/** The sheet is small: older splits are on the summary. */
const MAX_LISTED_SPLITS = 3;

export interface StatProps {
  slot: number;
  value: string;
  label: string;
  /** What a screen reader calls the figure, so the slot can be told apart when changing it. */
  name: string;
  onEdit(slot: number): void;
}

/** Wraps a figure so a long press (or the screen reader's "Change stat" action) opens the picker. */
export function EditableStat({
  slot,
  name,
  onEdit,
  style,
  children,
}: Pick<StatProps, 'slot' | 'name' | 'onEdit'> & {
  style: ComponentProps<typeof Pressable>['style'];
  children: ReactNode;
}) {
  return (
    <Pressable
      style={style}
      onLongPress={() => onEdit(slot)}
      accessibilityRole="button"
      accessibilityLabel={`Change stat, currently ${name}`}
      accessibilityHint="Press and hold to choose another figure"
      accessibilityActions={[{ name: 'activate', label: 'Change stat' }]}
      onAccessibilityAction={() => onEdit(slot)}
    >
      {children}
    </Pressable>
  );
}

const PrimaryStat = memo(function PrimaryStat({ value, label, ...edit }: StatProps) {
  return (
    <EditableStat {...edit} style={[styles.stat, styles.primaryStat]}>
      <ThemedText type="stat" numberOfLines={1} adjustsFontSizeToFit style={styles.primaryValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </EditableStat>
  );
});

const SecondaryStat = memo(function SecondaryStat({
  icon,
  iconColor,
  value,
  valueTone,
  label,
  ...edit
}: StatProps & {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  valueTone?: ThemeColor;
}) {
  return (
    <EditableStat {...edit} style={styles.stat}>
      <Ionicons name={icon} size={IconSize.badge} color={iconColor} />
      <ThemedText
        type="headline"
        themeColor={valueTone}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </EditableStat>
  );
});

interface RecordStatsProps {
  activityType: ActivityType;
  unitSystem: UnitSystem;
  /** What the recording knows right now; the chosen figures are worked out from it. */
  data: LiveStatData;
  /** Animated style and layout hook of the collapsible second row. */
  secondaryStyle: ComponentProps<typeof Animated.View>['style'];
  onSecondaryLayout(event: LayoutChangeEvent): void;
}

/** Six figures the athlete chooses: three big ones, three on a row that expands, then laps and splits. */
export function RecordStats({
  activityType,
  unitSystem,
  data,
  secondaryStyle,
  onSecondaryLayout,
}: RecordStatsProps) {
  const theme = useTheme();
  const { layout, choices, choose } = useLiveStatLayout(activityType);
  // The slot whose picker is open; null when closed.
  const [editing, setEditing] = useState<number | null>(null);
  const openPicker = (slot: number) => setEditing(slot);
  const closePicker = () => setEditing(null);

  const { lapCount, lastLap, splits } = data;
  const latest = splits.slice(-MAX_LISTED_SPLITS);

  const current = editing === null ? undefined : layout[editing];
  const actions: SheetAction[] = choices.map((field) => ({
    label: field.name,
    icon: field.id === current ? 'checkmark' : field.icon,
    onPress: () => editing !== null && choose(editing, field.id),
  }));

  const stat = (id: LiveStatId, slot: number) => {
    const field = LIVE_STAT_FIELDS[id];
    return {
      slot,
      name: field.name,
      value: field.value(data, unitSystem),
      label: field.label(unitSystem),
      onEdit: openPicker,
    };
  };
  const secondary = layout
    .slice(PRIMARY_LIVE_STAT_SLOTS)
    .map((id, i) => ({ id, slot: PRIMARY_LIVE_STAT_SLOTS + i }))
    // A figure with no data behind it at all (no altitude) is left out rather than shown as a dash.
    .filter(({ id }) => LIVE_STAT_FIELDS[id].available?.(data) !== false);

  return (
    <>
      <View style={styles.primaryRow}>
        {layout.slice(0, PRIMARY_LIVE_STAT_SLOTS).map((id, slot) => (
          <PrimaryStat key={slot} {...stat(id, slot)} />
        ))}
      </View>
      <ActionSheet
        visible={editing !== null}
        title="Change stat"
        actions={actions}
        onClose={closePicker}
      />
      <Animated.View style={[styles.secondary, secondaryStyle]}>
        <View
          style={[styles.secondaryInner, { borderTopColor: theme.border }]}
          onLayout={onSecondaryLayout}
        >
          <View style={styles.secondaryRow}>
            {secondary.map(({ id, slot }) => {
              const field = LIVE_STAT_FIELDS[id];
              const good = field.tone?.(data) === 'success';
              return (
                <SecondaryStat
                  key={slot}
                  {...stat(id, slot)}
                  icon={field.icon}
                  iconColor={good ? Brand.success : theme.textSecondary}
                  valueTone={good ? 'successText' : undefined}
                />
              );
            })}
          </View>
          {lapCount > 0 && lastLap && (
            <View style={styles.splits} accessibilityLabel="Laps">
              <View style={styles.splitRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Laps
                </ThemedText>
                <ThemedText type="smallBold">{lapCount}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {lapSummary(lastLap, unitSystem)}
              </ThemedText>
            </View>
          )}
          {latest.length > 0 && (
            <View style={styles.splits} accessibilityLabel="Latest splits">
              {latest.map((split) => (
                <View key={split.index} style={styles.splitRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {unitSystem === 'imperial' ? 'mi' : 'km'} {split.index}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {formatPaceOrSpeed(activityType, split.distance, split.movingTime, unitSystem)}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  primaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  stat: { alignItems: 'center', gap: Spacing.half },
  // Equal columns, so a long time or pace shrinks to fit instead of running into its neighbour.
  primaryStat: { flex: 1, minWidth: 0 },
  primaryValue: { alignSelf: 'stretch', textAlign: 'center' },
  secondary: { overflow: 'hidden' },
  secondaryInner: {
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  splits: { paddingHorizontal: Spacing.three, gap: Spacing.one },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
