import { StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatDistance, formatDuration, type UnitSystem, type WeeklyStats } from '@/utils/format';
import { countOf } from '@/utils/plural';
import { weekdayLabels } from '@/utils/trainingLog';
import { Card } from './card';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  stats: WeeklyStats;
  goals: { distance: number; activities: number; time: number };
  unitSystem: UnitSystem;
}

function WeekStat({ value, label, progress }: { value: string; label: string; progress: number }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.weekStatItem}>
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.weekStatValue, { color: theme.text }]}
      >
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedView style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedView
          style={[
            styles.progressFill,
            { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: theme.text },
          ]}
        />
      </ThemedView>
    </ThemedView>
  );
}

export function WeeklyProgressCard({ stats, goals, unitSystem }: Props) {
  const theme = useTheme();
  const busiestDay = Math.max(...stats.dailyActivityCount, 1);
  const labels = weekdayLabels(useSettingsStore((s) => s.weekStartsOn));

  return (
    <Card style={styles.section}>
      <ThemedView>
        <ThemedText type="sectionTitle">This Week</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {countOf(stats.activityCount, 'activity', 'activities')} ·{' '}
          {formatDistance(stats.totalDistance, unitSystem)}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.weekStatsRow}>
        <WeekStat
          value={formatDistance(stats.totalDistance, unitSystem)}
          label="Distance"
          progress={stats.totalDistance / goals.distance}
        />
        <WeekStat
          value={String(stats.activityCount)}
          label="Activities"
          progress={stats.activityCount / goals.activities}
        />
        <WeekStat
          value={formatDuration(stats.totalDuration)}
          label="Time"
          progress={stats.totalDuration / goals.time}
        />
      </ThemedView>

      <ThemedView style={[styles.chartBar, { borderTopColor: theme.border }]}>
        {stats.dailyActivityCount.map((count, i) => (
          <ThemedView key={i} style={styles.dayCol}>
            <ThemedView
              style={[
                styles.dayBar,
                {
                  height: Math.max((count / busiestDay) * 44, count > 0 ? 6 : 2),
                  backgroundColor: count > 0 ? theme.brand.primary : theme.backgroundSelected,
                },
              ]}
            />
            <ThemedText type="caption" style={[styles.dayLabel, { color: theme.textSecondary }]}>
              {labels[i]}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { padding: Spacing.four, gap: Spacing.three },
  weekStatsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingVertical: Spacing.one,
  },
  weekStatItem: { flex: 1, gap: Spacing.one },
  weekStatValue: textStyle(TypeScale.headline),
  progressTrack: {
    height: 3,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  chartBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 72,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dayCol: { alignItems: 'center', gap: Spacing.one },
  dayBar: { width: 28, borderRadius: BorderRadius.sm },
  dayLabel: { fontWeight: '600' },
});
