import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { formatTokenAmount } from '@/utils/eth';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { WalletChip } from './wallet-chip';

type IconName = keyof typeof Ionicons.glyphMap;

/** Headline totals in a row, split by hairlines (own profile and athlete profiles). */
export function ProfileTotals({
  items,
  compact = false,
}: {
  items: ReadonlyArray<{ icon?: IconName; value: string | ReactElement; label: string }>;
  /** Smaller figures, for rows of up to five. */
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.totals, { backgroundColor: theme.backgroundElement }]}>
      {items.map((item, i) => (
        <ThemedView key={item.label} style={styles.totalsCell}>
          {i > 0 && <ThemedView style={[styles.divider, { backgroundColor: theme.border }]} />}
          <ThemedView style={[styles.total, compact && styles.totalCompact]}>
            {item.icon && <Ionicons name={item.icon} size={16} color={theme.textSecondary} />}
            {typeof item.value === 'string' ? (
              <ThemedText style={[styles.totalValue, compact && styles.totalValueCompact]}>
                {item.value}
              </ThemedText>
            ) : (
              item.value
            )}
            <ThemedText type="caption" themeColor="textSecondary">
              {item.label}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

/** The account's name or address (tap to copy) and its STRD balance, with the ticker. */
export function WalletPills({
  address,
  ensName,
  strdWei,
}: {
  address: string | null;
  ensName?: string | null;
  strdWei: bigint | null;
}) {
  const theme = useTheme();
  if (!address && strdWei === null) return null;
  return (
    <ThemedView style={styles.pills}>
      <WalletChip address={address} ensName={ensName} />
      {strdWei !== null && (
        <TouchableOpacity
          style={[styles.pill, { borderColor: theme.border }]}
          onPress={() => router.push('/cash-out')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${formatTokenAmount(strdWei, 'STRD')} balance, cash out`}
        >
          <Ionicons name="disc-outline" size={13} color={theme.brand.primary} />
          <ThemedText type="small" style={[styles.pillText, { color: theme.text }]}>
            {formatTokenAmount(strdWei, 'STRD')}
          </ThemedText>
          <Ionicons name="swap-horizontal" size={11} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const PARTNER_SHORTCUTS: { icon: IconName; label: string; href: Href }[] = [
  { icon: 'sparkles-outline', label: 'AI Coach', href: '/coach' },
  { icon: 'flag-outline', label: 'Segments', href: '/segments' },
  { icon: 'swap-horizontal-outline', label: 'Cash out', href: '/cash-out' },
];

/** Coach (World Agent Pass), Arkiv segments and the Uniswap cash-out, one tap from the profile. */
export function PartnerShortcuts() {
  const theme = useTheme();
  return (
    <ThemedView style={styles.pills}>
      {PARTNER_SHORTCUTS.map(({ icon, label, href }) => (
        <TouchableOpacity
          key={label}
          style={[styles.pill, { borderColor: theme.brand.primary }]}
          onPress={() => router.push(href)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Ionicons name={icon} size={13} color={theme.brand.primary} />
          <ThemedText type="small" style={[styles.pillText, { color: theme.brand.primary }]}>
            {label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.three,
  },
  totalsCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  total: { flex: 1, alignItems: 'center', gap: Spacing.one },
  totalValue: textStyle(TypeScale.sectionTitle),
  totalCompact: { gap: Spacing.half },
  totalValueCompact: textStyle(TypeScale.body),
  divider: { width: StyleSheet.hairlineWidth, height: 32 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillText: textStyle(TypeScale.footnoteBold),
});
