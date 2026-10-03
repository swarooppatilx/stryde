import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { syncStatusText } from '@/utils/syncStatus';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface Props {
  /** The activity's retry bookkeeping, which decides what the message says. */
  sync?: { attempts: number };
  busy: boolean;
  onRetry(): void;
}

/** Shown to the owner of an activity the chain does not hold yet: says so and offers another try. */
export function ChainSyncRetry({ sync, busy, onRetry }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.message}>
        {syncStatusText(sync)}
      </ThemedText>
      <Tappable
        onPress={onRetry}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Retry sync"
        accessibilityState={{ busy, disabled: busy }}
        style={styles.button}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.accentText} />
        ) : (
          <ThemedText type="smallBold" themeColor="accentText">
            Retry
          </ThemedText>
        )}
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  message: { flex: 1 },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
