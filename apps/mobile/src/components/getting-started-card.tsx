import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { SETUP_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type ChecklistId, type ChecklistItem, nextChecklistItem } from '@/utils/gettingStarted';

interface GettingStartedCardProps {
  items: readonly ChecklistItem[];
  onOpen(id: ChecklistId): void;
  onDismiss(): void;
}

/**
 * One row on Home with the next first step. The full four-row list used to sit above the feed and
 * pushed it more than a quarter of the screen down, so only the step that is next is shown.
 */
export function GettingStartedCard({ items, onOpen, onDismiss }: GettingStartedCardProps) {
  const theme = useTheme();
  const next = nextChecklistItem(items);
  if (!next) return null;
  const done = items.filter((item) => item.done).length;
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Tappable
        onPress={() => onOpen(next.id)}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`${SETUP_COPY.checklist.title}, ${done} of ${items.length} done. ${SETUP_COPY.checklist[next.id]}`}
      >
        <Ionicons name="ellipse-outline" size={22} color={theme.brand.primary} />
        <View style={styles.text}>
          <ThemedText type="small">{SETUP_COPY.checklist[next.id]}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {`${SETUP_COPY.checklist.title} · ${done} of ${items.length} done`}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Tappable>
      <Tappable
        onPress={onDismiss}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel={SETUP_COPY.checklist.dismiss}
      >
        <Ionicons name="close" size={20} color={theme.textSecondary} />
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingLeft: Spacing.three,
  },
  text: { flex: 1 },
  close: { padding: Spacing.three },
});
