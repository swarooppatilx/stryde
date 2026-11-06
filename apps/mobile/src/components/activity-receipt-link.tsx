import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Toast } from '@/utils/toast';

/** Opens the block explorer's copy of this activity's proof. */
export function ActivityReceiptLink({ url }: { url: string }) {
  const theme = useTheme();
  return (
    <Tappable
      style={styles.row}
      onPress={() =>
        Linking.openURL(url).catch(() => {
          Toast.fail('Could not open the receipt', 1);
        })
      }
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel="Verified. View the receipt for this activity"
      // The label row renders ~17dp tall; +16 vertical reaches the 48dp floor.
      hitSlop={{ top: 16, bottom: 16 }}
    >
      <Ionicons name="receipt-outline" size={IconSize.badge} color={theme.brand.primary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Verified · View receipt
      </ThemedText>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // flex 1 so the label takes the row's remaining width: inside the nested scroll view it
  // otherwise measures a two-line box and wraps "receipt" even with space to spare.
  label: { flex: 1 },
});
