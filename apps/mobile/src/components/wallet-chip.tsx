import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPlatform } from '@/platform';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';
import { walletLabel } from '@/utils/walletLabel';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

/** The account's ENS name or short address; a tap copies the full address. */
export function WalletChip({
  address,
  ensName,
}: {
  address: string | null;
  ensName?: string | null;
}) {
  const theme = useTheme();
  const label = walletLabel({ ensName, address });
  if (!label || !address) return null;

  const copy = async () => {
    try {
      await getPlatform().clipboard.copyText(address);
      haptics.success();
      Toast.success('Address copied', 1);
    } catch (error) {
      logger.warn('[WalletChip] Copying the address failed', error);
      Toast.fail('Could not copy the address', 1);
    }
  };

  return (
    <Tappable
      onPress={() => void copy()}
      hitSlop={8}
      style={[styles.chip, { borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel="Copy wallet address"
      accessibilityHint={label}
    >
      <Ionicons name="wallet-outline" size={13} color={theme.textSecondary} />
      <ThemedText type="small" numberOfLines={1} style={styles.text}>
        {label}
      </ThemedText>
      <Ionicons name="copy-outline" size={13} color={theme.textSecondary} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  text: { flexShrink: 1 },
});
