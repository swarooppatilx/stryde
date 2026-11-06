import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ChipRow } from '@/components/filter-chips';
import { ListMessage } from '@/components/list-message';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useClubActivities } from '@/hooks/useClubActivities';
import { useUserResolver } from '@/hooks/useSocialUser';
import { type WeeklyMetric, weeklyLeaderboard, weeklyTotals } from '@/utils/clubWeekly';
import { formatDistance, formatDuration, getDisplayName } from '@/utils/format';

const WEEKS = [
  { value: '0', label: 'This week' },
  { value: '1', label: 'Last week' },
];
const METRICS: Array<{ value: WeeklyMetric; label: string }> = [
  { value: 'distance', label: 'Distance' },
  { value: 'time', label: 'Time' },
  { value: 'activities', label: 'Activities' },
];

interface ClubLeaderboardProps {
  members: readonly string[] | null;
  me: string;
  /** The club turned its leaderboard off. */
  hidden: boolean;
  isMember: boolean;
}

/** Who did most this week (or last), by distance, time or number of activities, and the club's totals. */
export function ClubLeaderboard({ members, me, hidden, isMember }: ClubLeaderboardProps) {
  const theme = useTheme();
  const router = useRouter();
  const unitSystem = useUnitSystem();
  const resolve = useUserResolver();
  const [week, setWeek] = useState('0');
  const [metric, setMetric] = useState<WeeklyMetric>('distance');
  const { activities, loading } = useClubActivities(members);
  const rows = useMemo(
    () => weeklyLeaderboard(activities, members ?? [], metric, Date.now(), Number(week)),
    [activities, members, metric, week]
  );
  const totals = weeklyTotals(rows);

  if (hidden) {
    return <ListMessage icon="podium-outline" text="This club has turned its leaderboard off." />;
  }
  if (!members) return <ActivityIndicator color={theme.brand.primary} />;

  const shownValue = (row: (typeof rows)[number]) => {
    if (metric === 'distance') return formatDistance(row.distance, unitSystem);
    return metric === 'time' ? formatDuration(row.duration) : String(row.activities);
  };

  const body = () => {
    if (loading && rows.length === 0) return <ActivityIndicator color={theme.brand.primary} />;
    if (rows.length === 0) {
      return (
        <ListMessage
          icon="podium-outline"
          text={
            isMember
              ? 'No activities yet this week. Time to get moving!'
              : 'Join the club to get on the board.'
          }
        />
      );
    }
    return rows.map((row) => {
      const user = resolve(row.athlete);
      const mine = row.athlete === me;
      const name = user ? getDisplayName(user) : `${row.athlete.slice(0, 6)}…`;
      return (
        <Tappable
          key={row.athlete}
          onPress={() => router.push(`/athletes/${row.athlete}`)}
          style={[
            styles.row,
            { backgroundColor: mine ? theme.brand.primaryTint : theme.backgroundElement },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${row.rank}. ${name}${mine ? ' (you)' : ''}, ${shownValue(row)}`}
        >
          <ThemedText type="smallBold" style={styles.rank}>
            {row.rank}
          </ThemedText>
          <UserAvatar uri={user?.avatar} name={name} size="sm" />
          <ThemedText type="small" numberOfLines={1} style={styles.name}>
            {name}
            {mine ? ' (you)' : ''}
          </ThemedText>
          <ThemedText type="smallBold">{shownValue(row)}</ThemedText>
        </Tappable>
      );
    });
  };

  return (
    <View style={styles.container}>
      <ChipRow options={WEEKS} value={week} onChange={setWeek} contentStyle={styles.chips} />
      <View style={[styles.totals, { backgroundColor: theme.backgroundElement }]}>
        {[
          { label: 'Distance', value: formatDistance(totals.distance, unitSystem) },
          { label: 'Time', value: formatDuration(totals.duration) },
          { label: 'Activities', value: String(totals.activities) },
          { label: 'Athletes', value: String(totals.athletes) },
        ].map((t) => (
          <View key={t.label} style={styles.total}>
            <ThemedText type="smallBold">{t.value}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {t.label}
            </ThemedText>
          </View>
        ))}
      </View>
      <ChipRow options={METRICS} value={metric} onChange={setMetric} contentStyle={styles.chips} />

      {body()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  chips: { paddingHorizontal: 0 },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
  },
  total: { alignItems: 'center', gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  rank: { width: 22, textAlign: 'center' },
  name: { flex: 1 },
});
