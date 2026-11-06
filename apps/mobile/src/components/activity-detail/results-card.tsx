import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AnalysisCard } from '@/components/activity-detail/analysis-card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityResults } from '@/utils/activityResults';
import { countOf } from '@/utils/plural';

interface Row {
  key: string;
  label: string;
  stat: string;
  href: '/athlete-stats' | `/badges/${string}`;
}

/** Best efforts, records and badges from this activity; records and badges open their own screens. */
export function ResultsCard({ results }: { results: ActivityResults }) {
  const router = useRouter();
  const theme = useTheme();
  const { bestEffortCount, records, achievements } = results;
  if (bestEffortCount === 0 && records.length === 0 && achievements.length === 0) return null;

  const rows: Row[] = [
    ...records.map((r) => ({
      key: `r-${r.kind}`,
      label: r.label,
      stat: r.stat,
      href: '/athlete-stats' as const,
    })),
    ...achievements.map((a) => ({
      key: `a-${a.id}`,
      label: a.label,
      stat: a.stat,
      href: `/badges/${a.id}` as const,
    })),
  ];
  const summary = [
    countOf(bestEffortCount, 'best effort', 'best efforts'),
    countOf(records.length, 'personal record', 'personal records'),
    countOf(achievements.length, 'achievement', 'achievements'),
  ].join(' · ');

  return (
    <AnalysisCard title="Results">
      <ThemedText type="small" themeColor="textSecondary">
        {summary}
      </ThemedText>
      {rows.map((row) => (
        <Tappable
          key={row.key}
          onPress={() => router.push(row.href)}
          accessibilityRole="link"
          accessibilityLabel={`${row.label}, ${row.stat}`}
          style={styles.row}
        >
          <Ionicons name="trophy-outline" size={16} color={theme.accentText} />
          <View style={styles.text}>
            <ThemedText type="small">{row.label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.stat}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Tappable>
      ))}
    </AnalysisCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  text: { flex: 1 },
});
