import { StyleSheet, View } from 'react-native';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import type { ReadinessActionKind, ReadinessCheck } from '@/utils/readiness';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface ReadinessCardProps {
  rows: ReadinessCheck[];
  onAction(kind: ReadinessActionKind): void;
}

/** A quiet list of what could stop a recording, shown only when something needs a look. */
export function ReadinessCard({ rows, onAction }: ReadinessCardProps) {
  const theme = useTheme();
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      accessibilityLabel={t('readiness.heading')}
    >
      <ThemedText type="smallBold">{t('readiness.heading')}</ThemedText>
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View
            style={[
              styles.dot,
              { backgroundColor: row.status === 'blocked' ? Brand.danger : Brand.warning },
              row.status === 'tip' && { backgroundColor: theme.disabled },
            ]}
          />
          <View style={styles.text}>
            <ThemedText type="small">{row.title}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.detail}
            </ThemedText>
          </View>
          {row.action && (
            <Tappable
              onPress={() => row.action && onAction(row.action.kind)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}. ${row.action.label}`}
              style={styles.action}
            >
              <ThemedText type="smallBold" themeColor="textSecondary">
                {row.action.label}
              </ThemedText>
            </Tappable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, gap: 2 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
});
