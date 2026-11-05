import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export interface BadgeItem {
  key: string;
  icon: ReactNode;
  label: string;
  /** Shows a check: the badge exists onchain. */
  minted: boolean;
  /** Opens the item's page. Items without one are not tappable. */
  onPress?: () => void;
}

export function BadgeGrid({
  title,
  items,
  action,
}: {
  title: string;
  items: readonly BadgeItem[];
  /** A link at the end of the title row, e.g. "See all". */
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  if (items.length === 0) return null;

  return (
    <ThemedView style={styles.section}>
      <View style={styles.titleRow}>
        <ThemedText type="eyebrow" style={[styles.title, { color: theme.textSecondary }]}>
          {title}
        </ThemedText>
        {action && (
          <Tappable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              {action.label}
            </ThemedText>
          </Tappable>
        )}
      </View>
      <ThemedView style={styles.grid}>
        {items.map((item) => (
          <Tappable
            key={item.key}
            onPress={item.onPress}
            disabled={!item.onPress}
            style={styles.cell}
            accessibilityRole={item.onPress ? 'button' : undefined}
            accessibilityLabel={
              item.onPress ? `${item.label}${item.minted ? ', minted' : ''}. Open badge` : undefined
            }
          >
            <ThemedView style={[styles.card, { borderColor: theme.border }]}>
              {item.minted && (
                <View style={styles.check}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.brand.success} />
                </View>
              )}
              {item.icon}
              <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
                {item.label}
              </ThemedText>
            </ThemedView>
          </Tappable>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: Spacing.two },
  title: { marginBottom: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: '30%' },
  card: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.two,
  },
  check: { position: 'absolute', top: 6, right: 6 },
  label: { textAlign: 'center' },
});
