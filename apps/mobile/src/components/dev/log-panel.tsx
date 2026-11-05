import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { AppButton } from '@/components/button';
import { Segmented } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useLogEntries } from '@/hooks/useLogEntries';
import { getPlatform } from '@/platform';
import type { LogEntry, LogLevel } from '@/utils/logBuffer';
import { logBuffer } from '@/utils/logger';
import { filterLogs, formatLogLine, formatLogTime } from '@/utils/logView';
import { shareLatestTrackingTrace } from '@/utils/share';
import { Toast } from '@/utils/toast';

const LEVELS: Array<{ value: LogLevel; label: string }> = [
  { value: 'debug', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
];

const keyOf = (entry: LogEntry) => String(entry.id);

/** What the app has logged since launch, newest first. */
export function LogPanel() {
  const theme = useTheme();
  const entries = useLogEntries();
  const [minLevel, setMinLevel] = useState<LogLevel>('debug');
  const [query, setQuery] = useState('');
  const visible = filterLogs(entries, { minLevel, query });

  const levelColor = (level: LogLevel) => {
    if (level === 'error') return theme.dangerText;
    return level === 'warn' ? theme.warningText : theme.textSecondary;
  };

  const copy = async () => {
    await getPlatform().clipboard.copyText(visible.map(formatLogLine).join('\n'));
    Toast.success('Copied', 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Segmented label="Level" value={minLevel} options={LEVELS} onChange={setMinLevel} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter"
          placeholderTextColor={theme.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.search,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        />
        <View style={styles.actions}>
          <View style={styles.action}>
            <AppButton size="small" variant="secondary" onPress={() => void copy()}>
              Copy
            </AppButton>
          </View>
          <View style={styles.action}>
            <AppButton size="small" variant="secondary" onPress={() => logBuffer.clear()}>
              Clear
            </AppButton>
          </View>
        </View>
        <AppButton size="small" variant="secondary" onPress={() => void shareLatestTrackingTrace()}>
          Share latest tracking trace
        </AppButton>
      </View>
      <FlatList
        data={visible}
        keyExtractor={keyOf}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary">
            Nothing logged yet.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedText style={styles.line}>
            <ThemedText style={[styles.line, { color: theme.textSecondary }]}>
              {formatLogTime(item.time)}{' '}
            </ThemedText>
            <ThemedText style={[styles.line, { color: levelColor(item.level) }]}>
              {item.level.toUpperCase()}{' '}
            </ThemedText>
            {item.message}
          </ThemedText>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { padding: Spacing.four, gap: Spacing.two },
  search: {
    ...textStyle(TypeScale.body),
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },
  line: textStyle(TypeScale.footnote),
});
