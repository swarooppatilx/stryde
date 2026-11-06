import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useMemo } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { BorderRadius, Brand, IconSize, Spacing, Touch, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveStatLayout } from '@/hooks/useLiveStatLayout';
import type { ActivityType } from '@/types';
import type { UnitSystem } from '@/utils/format';
import { LIVE_STAT_FIELDS, type LiveStatData } from '@/utils/liveStats';
import { islandStatIds } from '@/utils/recordIsland';
import { ThemedText } from './themed-text';

interface RecordIslandProps {
  activityType: ActivityType;
  unitSystem: UnitSystem;
  data: LiveStatData;
  sportIcon: keyof typeof Ionicons.glyphMap;
  sportLabel: string;
  /** Shown beside the sport, e.g. a weak GPS signal. */
  badge?: ReactNode;
  onLock(): void;
  onExpand(): void;
  onLayout(event: LayoutChangeEvent): void;
  /** Notices that belong with the figures: paused, a finished lap, recording stops with the screen. */
  children?: ReactNode;
}

/** The figures of a recording, floating over the map: the sport, up to three stats and the way to the big view. */
export function RecordIsland({
  activityType,
  unitSystem,
  data,
  sportIcon,
  sportLabel,
  badge,
  onLock,
  onExpand,
  onLayout,
  children,
}: RecordIslandProps) {
  const theme = useTheme();
  const { layout } = useLiveStatLayout(activityType);
  const ids = useMemo(
    () => islandStatIds(layout, (id) => LIVE_STAT_FIELDS[id].available?.(data) !== false),
    [layout, data]
  );

  return (
    <View
      onLayout={onLayout}
      style={[styles.island, { backgroundColor: theme.backgroundElement }, theme.shadows.overlay]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.sportIcon, { backgroundColor: tint(Brand.primary, 0.15) }]}>
            <Ionicons name={sportIcon} size={IconSize.badge} color={Brand.primary} />
          </View>
          <ThemedText type="sectionTitle" numberOfLines={1} style={styles.sportLabel}>
            {sportLabel}
          </ThemedText>
          {badge}
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={onLock}
          accessibilityRole="button"
          accessibilityLabel="Lock the screen"
        >
          <Ionicons name="lock-closed-outline" size={IconSize.inline} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel="Open full screen stats"
        >
          <Ionicons name="expand" size={IconSize.inline} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.stats}>
        {ids.map((id) => {
          const field = LIVE_STAT_FIELDS[id];
          return (
            <View key={id} style={styles.stat} accessible accessibilityLabel={field.name}>
              <ThemedText
                type="titleSmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.value}
              >
                {field.value(data, unitSystem)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {field.label(unitSystem)}
              </ThemedText>
            </View>
          );
        })}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  island: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sportIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportLabel: { flexShrink: 1 },
  iconButton: {
    minWidth: Touch.target,
    minHeight: Touch.target,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: Spacing.half },
  value: { alignSelf: 'stretch', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
