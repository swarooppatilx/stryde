import { FlatList, StyleSheet, View } from 'react-native';
import { getOutbox } from '@/backends/outbox/appOutbox';
import type { OutboxEntry } from '@/backends/outbox/outbox';
import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOutboxEntries } from '@/hooks/useOutbox';

const keyOf = (entry: OutboxEntry) => entry.id;

const statusLabel = (entry: OutboxEntry) => {
  if (entry.status === 'failed') return 'Gave up';
  return entry.attempts > 0 ? 'Retrying' : 'Waiting';
};

/** What the app has done locally and still has to tell the chain or the server. */
export function OutboxPanel() {
  const theme = useTheme();
  const entries = useOutboxEntries();

  return (
    <FlatList
      data={entries}
      keyExtractor={keyOf}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <ThemedText type="caption" themeColor="textSecondary">
          Changes apply on screen at once and are delivered from here in the background. An empty
          list means everything has been delivered.
        </ThemedText>
      }
      ListEmptyComponent={
        <ThemedText type="small" themeColor="textSecondary">
          Nothing waiting.
        </ThemedText>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.header}>
            <ThemedText type="smallBold">{item.kind}</ThemedText>
            <ThemedText
              type="eyebrow"
              themeColor={item.status === 'failed' ? 'dangerText' : 'textSecondary'}
            >
              {statusLabel(item)}
            </ThemedText>
          </View>
          {item.key && (
            <ThemedText type="caption" themeColor="textSecondary">
              {item.key}
            </ThemedText>
          )}
          {item.lastError && (
            <ThemedText type="caption" themeColor="dangerText">
              {item.attempts} tries. {item.lastError}
            </ThemedText>
          )}
          {item.status === 'failed' && (
            <AppButton
              size="small"
              variant="secondary"
              onPress={() => {
                const outbox = getOutbox();
                void outbox.retry(item.id).then(() => outbox.drain());
              }}
            >
              Try again
            </AppButton>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, gap: Spacing.two },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.three, gap: Spacing.one },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
