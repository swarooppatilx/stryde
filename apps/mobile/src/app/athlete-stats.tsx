import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';
import { Card } from '@/components/card';
import { ChipRow } from '@/components/filter-chips';
import { GoalProgressCard } from '@/components/goal-progress-card';
import { PersonalRecordsCard } from '@/components/personal-records-card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoals } from '@/hooks/useGoals';
import { useGoBack } from '@/hooks/useGoBack';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSocialStore, visibleActivities } from '@/stores/socialStore';
import { sameAddress } from '@/utils/address';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  SPORT_LABEL,
  type UnitSystem,
} from '@/utils/format';
import { goalProgress, weeksInMonth, weeksInYear } from '@/utils/goalProgress';
import { weeklyTargets } from '@/utils/goals';
import { type PeriodStats, periodStats, sportBreakdown, sportsDone } from '@/utils/periodStats';
import { personalRecords } from '@/utils/personalRecords';
import { countOf } from '@/utils/plural';
import { computeStreak } from '@/utils/profile';
import { bestWeek } from '@/utils/trainingLog';

type Filter = 'all' | string;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

function PeriodCard({
  title,
  stats,
  unitSystem,
}: {
  title: string;
  stats: PeriodStats;
  unitSystem: UnitSystem;
}) {
  return (
    <Card style={styles.card}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      <StatRow label="Activities" value={String(stats.count)} />
      <StatRow label="Distance" value={formatDistance(stats.distance, unitSystem)} />
      <StatRow label="Time" value={formatDuration(stats.duration)} />
      <StatRow label="Elevation gain" value={formatElevation(stats.elevation, unitSystem)} />
      <StatRow label="Active days" value={countOf(stats.activeDays, 'day', 'days')} />
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Average per week
      </ThemedText>
      <StatRow label="Activities" value={stats.activitiesPerWeek.toFixed(1)} />
      <StatRow label="Distance" value={formatDistance(stats.distancePerWeek, unitSystem)} />
      <StatRow label="Time" value={formatDuration(stats.durationPerWeek)} />
      <StatRow label="Elevation gain" value={formatElevation(stats.elevationPerWeek, unitSystem)} />
    </Card>
  );
}

/** Totals for the last four weeks, this year and all time, for everything or one sport. */
export default function AthleteStatsScreen() {
  const theme = useTheme();
  const goBack = useGoBack();
  const unitSystem = useUnitSystem();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useCurrentUserId();
  const ownActivities = useActivityStore((s) => s.activities);
  const socialActivities = useSocialStore((s) => s.activities);
  const following = useSocialStore((s) => s.following);
  const isOther = !!id && !sameAddress(id, me);
  // Another athlete's totals count what they have shared with the viewer.
  const activities = isOther
    ? visibleActivities(
        Object.values(socialActivities).filter((a) => sameAddress(a.userId, id)),
        me,
        following
      )
    : ownActivities;
  const [filter, setFilter] = useState<Filter>('all');

  const sports = sportsDone(activities);
  const options = [
    { value: 'all', label: 'All' },
    ...sports.map((sport) => ({ value: sport as string, label: SPORT_LABEL[sport] ?? sport })),
  ];
  const shown = filter === 'all' ? activities : activities.filter((a) => a.activityType === filter);
  const stats = periodStats(shown, new Date());
  const bySport = sportBreakdown(activities);
  const records = personalRecords(shown);
  const longestStreak = computeStreak([...shown]).longest;
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const best = bestWeek(
    shown.filter((a) => !a.isManual),
    weekStartsOn
  );
  // The Goals list is where weekly targets are edited now; the old profile settings only fill in
  // for a metric with no weekly goal, so this screen agrees with the Progress tab.
  const goalList = useGoals();
  const legacy = useProfileStore(
    useShallow((s) => ({
      distance: s.settings.weeklyGoalDistance,
      activities: s.settings.weeklyGoalActivities,
      time: s.settings.weeklyGoalTime,
    }))
  );
  const goals = weeklyTargets(goalList, legacy);
  const month = goalProgress(stats.thisMonth, goals, weeksInMonth(new Date()));
  const year = goalProgress(stats.thisYear, goals, weeksInYear(new Date()));

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">Statistics</ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {sports.length > 1 ? (
            <ChipRow options={options} value={filter} onChange={setFilter} />
          ) : null}
          {activities.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              {isOther
                ? 'No activities to show yet.'
                : 'Your totals will show up here once you have recorded an activity.'}
            </ThemedText>
          ) : (
            <>
              <PeriodCard title="Last 4 weeks" stats={stats.recent} unitSystem={unitSystem} />
              <PeriodCard title="This year" stats={stats.thisYear} unitSystem={unitSystem} />
              <PeriodCard title="All time" stats={stats.allTime} unitSystem={unitSystem} />
              {isOther ? null : (
                <GoalProgressCard month={month} year={year} unitSystem={unitSystem} />
              )}
              {filter === 'all' && bySport.length > 1 ? (
                <Card style={styles.card}>
                  <ThemedText type="sectionTitle">By sport</ThemedText>
                  {bySport.map((row) => (
                    <StatRow
                      key={row.sport}
                      label={`${SPORT_LABEL[row.sport] ?? row.sport} · ${countOf(row.count, 'activity', 'activities')}`}
                      value={`${formatDistance(row.distance, unitSystem)} · ${formatDuration(row.duration)}`}
                    />
                  ))}
                </Card>
              ) : null}
              <PersonalRecordsCard
                records={records}
                bestWeek={best}
                longestStreak={longestStreak}
                unitSystem={unitSystem}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  spacer: { width: 24 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
