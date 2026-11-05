import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration, type UnitSystem } from '@/utils/format';
import type { GoalLine, GoalProgress } from '@/utils/goalProgress';

interface Props {
  month: GoalProgress;
  year: GoalProgress;
  unitSystem: UnitSystem;
}

function Bar({ label, line, text }: { label: string; line: GoalLine; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bar} accessible accessibilityLabel={`${label}: ${text}`}>
      <View style={styles.barText}>
        <ThemedText themeColor="textSecondary">{label}</ThemedText>
        <ThemedText type="small">{text}</ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            { width: `${line.ratio * 100}%`, backgroundColor: theme.brand.primary },
          ]}
        />
      </View>
    </View>
  );
}

function Period({
  title,
  progress,
  unitSystem,
}: {
  title: string;
  progress: GoalProgress;
  unitSystem: UnitSystem;
}) {
  return (
    <View style={styles.period}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {title}
      </ThemedText>
      <Bar
        label="Distance"
        line={progress.distance}
        text={`${formatDistance(progress.distance.done, unitSystem)} of ${formatDistance(progress.distance.goal, unitSystem)}`}
      />
      <Bar
        label="Activities"
        line={progress.activities}
        text={`${progress.activities.done} of ${Math.round(progress.activities.goal)}`}
      />
      <Bar
        label="Time"
        line={progress.time}
        text={`${formatDuration(progress.time.done)} of ${formatDuration(progress.time.goal)}`}
      />
    </View>
  );
}

/** Where the month and the year stand against the weekly goals, spread over their weeks. */
export function GoalProgressCard({ month, year, unitSystem }: Props) {
  return (
    <Card style={styles.card}>
      <ThemedText type="sectionTitle">Goal progress</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your weekly goals, spread over the month and the year.
      </ThemedText>
      <Period title="This month" progress={month} unitSystem={unitSystem} />
      <Period title="This year" progress={year} unitSystem={unitSystem} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  period: { gap: Spacing.two },
  bar: { gap: Spacing.one },
  barText: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill: { height: 6, borderRadius: BorderRadius.full },
});
