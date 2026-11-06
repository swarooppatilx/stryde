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
import { totalCost, trustChip } from '@/utils/zeroGTrust';

/** "Ran on 0G": the model and router request id behind each result; tap to copy the full id. */
export function ZeroGReceipts({ receipts }: { receipts: readonly ZeroGReceipt[] }) {
  const theme = useTheme();
  if (receipts.length === 0) return null;
  const trust = trustChip(receipts);
  const cost = totalCost(receipts);
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
      {trust || cost ? (
        <ThemedView style={styles.chips}>
          {trust ? (
            <ThemedView style={styles.row} accessible accessibilityLabel={trust.label}>
              <Ionicons
                name={trust.tone === 'verified' ? 'shield-checkmark' : 'shield-outline'}
                size={12}
                color={trust.tone === 'verified' ? theme.successText : theme.warningText}
              />
              <ThemedText
                type="caption"
                style={{ color: trust.tone === 'verified' ? theme.successText : theme.warningText }}
              >
                {trust.label}
              </ThemedText>
            </ThemedView>
          ) : null}
          {cost ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {cost}
            </ThemedText>
          ) : null}
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.half },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  chips: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
});
