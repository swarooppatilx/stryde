import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDayYear } from '@/utils/dates';
import { formatDistance, formatDuration, type UnitSystem } from '@/utils/format';
import { type PersonalRecord, RECORD_LABEL, recordValueText } from '@/utils/personalRecords';
import { countOf } from '@/utils/plural';
import type { WeekBucket } from '@/utils/trainingLog';

interface Props {
  records: readonly PersonalRecord[];
  /** The week with the most distance; a record that belongs to no single activity. */
  bestWeek?: WeekBucket | null;
  /** The most days in a row with an activity; shown from two days up. */
  longestStreak?: number;
  unitSystem: UnitSystem;
}

/** The athlete's bests; each row opens the activity that set it. */
export function PersonalRecordsCard({ records, bestWeek, longestStreak = 0, unitSystem }: Props) {
  const router = useRouter();
  if (records.length === 0 && !bestWeek && longestStreak < 2) return null;
  return (
    <Card style={styles.card}>
      <ThemedText type="sectionTitle">Personal records</ThemedText>
      {records.map((record) => {
        const value = recordValueText(record, unitSystem);
        const when = formatDayYear(record.at);
        // The next best times, as a quiet line: a record is more meaningful beside what it beat.
        const nextText = record.runnersUp?.map((r) => formatDuration(r.value)).join(', ');
        return (
          <Tappable
            key={record.kind}
            style={styles.row}
            onPress={() => router.push(`/activities/${record.activityId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${RECORD_LABEL[record.kind]}, ${value}, ${when}.${nextText ? ` Next best ${nextText}.` : ''} Open the activity`}
          >
            <View style={styles.label}>
              <ThemedText themeColor="textSecondary">{RECORD_LABEL[record.kind]}</ThemedText>
              <ThemedText type="caption" themeColor="textTertiary">
                {when}
              </ThemedText>
              {nextText ? (
                <ThemedText type="caption" themeColor="textTertiary">
                  Next: {nextText}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText type="smallBold">{value}</ThemedText>
          </Tappable>
        );
      })}
      {bestWeek ? (
        <View
          style={styles.row}
          accessible
          accessibilityLabel={`Best week, ${formatDistance(bestWeek.distance, unitSystem)}, week of ${formatDayYear(bestWeek.start)}`}
        >
          <View style={styles.label}>
            <ThemedText themeColor="textSecondary">Best week</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              Week of {formatDayYear(bestWeek.start)}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{formatDistance(bestWeek.distance, unitSystem)}</ThemedText>
        </View>
      ) : null}
      {longestStreak >= 2 ? (
        <View
          style={styles.row}
          accessible
          accessibilityLabel={`Longest streak, ${countOf(longestStreak, 'day', 'days')}`}
        >
          <ThemedText themeColor="textSecondary">Longest streak</ThemedText>
          <ThemedText type="smallBold">{countOf(longestStreak, 'day', 'days')}</ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { gap: 2 },
});
