import { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { getTimeToIndexed } from '@/services/timeToIndexed';
import type { AppEvent } from '@/utils/eventLog';
import { formatLogTime } from '@/utils/logView';
import { formatSeconds } from '@/utils/timeToIndexed';

const okSuffix = (ok: boolean | undefined) => {
  if (ok === undefined) return '';
  return ok ? ' ok' : ' failed';
};

const countsText = (counts: AppEvent['counts']) =>
  counts
    ? ` ${Object.entries(counts)
        .map(([name, n]) => `${name}=${n}`)
        .join(' ')}`
    : '';

const line = (e: AppEvent) =>
  `${formatLogTime(e.at)} ${e.name}${e.durationMs === undefined ? '' : ` ${formatSeconds(e.durationMs)}`}${okSuffix(e.ok)}${countsText(e.counts)} #${e.run}`;

/** The app's recent events since launch, newest first. Read-only; lives in memory only. */
export function EventsPanel() {
  const [events, setEvents] = useState<AppEvent[]>(() => getTimeToIndexed().log.snapshot());
  useEffect(() => {
    const timer = setInterval(() => setEvents(getTimeToIndexed().log.snapshot()), 1500);
    return () => clearInterval(timer);
  }, []);
  const newestFirst = [...events].reverse();

  return (
    <FlatList
      data={newestFirst}
      keyExtractor={(_, i) => String(newestFirst.length - i)}
      contentContainerStyle={styles.list}
      accessibilityLabel="Recent events"
      ListEmptyComponent={
        <ThemedText type="small" themeColor="textSecondary">
          No events yet. Save an activity to see its timings.
        </ThemedText>
      }
      renderItem={({ item }) => <ThemedText style={styles.line}>{line(item)}</ThemedText>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, gap: Spacing.two },
  line: textStyle(TypeScale.footnote),
});
