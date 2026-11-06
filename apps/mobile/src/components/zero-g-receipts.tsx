import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shortRequestId, type ZeroGReceipt } from '@/services/coachService';
import { Toast } from '@/utils/toast';

/** "Ran on 0G": the model and router request id behind each result; tap to copy the full id. */
export function ZeroGReceipts({ receipts }: { receipts: readonly ZeroGReceipt[] }) {
  const theme = useTheme();
  if (receipts.length === 0) return null;
  return (
    <ThemedView style={styles.list}>
      {receipts.map((r, i) => (
        <Tappable
          key={r.requestId ?? i}
          onPress={async () => {
            if (!r.requestId) return;
            await Clipboard.setStringAsync(r.requestId);
            Toast.success('0G request id copied', 1);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Ran on 0G with ${r.model}. Request ${r.requestId ?? 'unknown'}. Copy the request id`}
          hitSlop={8}
          style={styles.row}
        >
          <Ionicons name="shield-checkmark-outline" size={12} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            0G · {r.model} · {shortRequestId(r.requestId)}
          </ThemedText>
        </Tappable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.half },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
