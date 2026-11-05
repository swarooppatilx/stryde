import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { ChipRow } from '@/components/filter-chips';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { useActivityStore } from '@/stores/activityStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatDistance, formatDuration, formatElevation, SPORT_LABEL } from '@/utils/format';
import { countOf } from '@/utils/plural';
import { shareText } from '@/utils/share';
import { monthName, weekdayName, yearInSport, yearShareMessage } from '@/utils/yearInSport';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="stat">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** One calendar year of the athlete's own activities, from this phone, with a line to share. */
function yearsWithActivity(
  activities: readonly { createdAt: Date }[],
  currentYear: number
): string[] {
  const found = new Set<number>([currentYear]);
  for (const a of activities) found.add(new Date(a.createdAt).getFullYear());
  return [...found].sort((a, b) => b - a).map(String);
}

export default function YearInSportScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const activities = useActivityStore((s) => s.activities);
  const now = new Date();

  const years = yearsWithActivity(activities, now.getFullYear());
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? years[0] ?? String(now.getFullYear());

  const year = yearInSport(activities, Number(selected), now, weekStartsOn);
  const distanceText = formatDistance(year.distance, unitSystem);

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
          <ThemedText type="sectionTitle" accessibilityRole="header">
            Year in sport
          </ThemedText>
          <View style={styles.spacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {years.length > 1 && (
            <ChipRow
              options={years.map((y) => ({ value: y, label: y }))}
              value={selected}
              onChange={setPicked}
            />
          )}

          {year.count === 0 ? (
            <Card>
              <ThemedText type="smallBold">Nothing logged in {selected} yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Record or add an activity and your year fills in here.
              </ThemedText>
            </Card>
          ) : (
            <>
              <Card style={styles.hero}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  {selected}
                </ThemedText>
                <ThemedText type="display">{distanceText}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`${countOf(year.count, 'activity', 'activities')} on ${countOf(
                    year.activeDays,
                    'day',
                    'days'
                  )}`}
                </ThemedText>
              </Card>

              <View style={styles.facts}>
                <Fact label="Time moving" value={formatDuration(year.duration)} />
                <Fact label="Climbed" value={formatElevation(year.elevation, unitSystem)} />
                <Fact
                  label="Best weekly streak"
                  value={countOf(year.bestWeeklyStreak, 'week', 'weeks')}
                />
              </View>

              <Card style={styles.list}>
                {year.topMonth !== null && (
                  <ThemedText type="small">{`Biggest month: ${monthName(year.topMonth)}`}</ThemedText>
                )}
                {year.topWeekday !== null && (
                  <ThemedText type="small">{`Most active day: ${weekdayName(year.topWeekday)}`}</ThemedText>
                )}
                {year.longest && (
                  <ThemedText type="small">{`Longest: ${formatDistance(
                    year.longest.distance,
                    unitSystem
                  )} ${SPORT_LABEL[year.longest.sport] ?? year.longest.sport}`}</ThemedText>
                )}
              </Card>

              <Card style={styles.list}>
                <ThemedText type="smallBold">By sport</ThemedText>
                {year.sports.map((s) => (
                  <View key={s.sport} style={styles.sportRow}>
                    <ThemedText type="small">{SPORT_LABEL[s.sport] ?? s.sport}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {`${formatDistance(s.distance, unitSystem)} · ${s.count}`}
                    </ThemedText>
                  </View>
                ))}
              </Card>
            </>
          )}

          <AppButton
            variant="secondary"
            accessibilityLabel="Share your year"
            onPress={() => shareText(yearShareMessage(year, distanceText))}
          >
            Share
          </AppButton>
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
    paddingVertical: Spacing.three,
  },
  spacer: { width: 24 },
  content: { padding: Spacing.four, gap: Spacing.three },
  hero: { gap: Spacing.one },
  facts: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  fact: { flex: 1, gap: Spacing.half },
  list: { gap: Spacing.two },
  sportRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
