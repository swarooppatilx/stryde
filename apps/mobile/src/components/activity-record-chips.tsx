import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RECORD_LABEL, type RecordKind } from '@/utils/personalRecords';

/** The personal records this activity set, one chip each. */
export function ActivityRecordChips({ records }: { records: readonly RecordKind[] }) {
  const theme = useTheme();
  if (records.length === 0) return null;
  return (
    <ThemedView style={styles.row}>
      {records.map((kind) => (
        <ThemedView
          key={kind}
          style={[styles.chip, { backgroundColor: tint(theme.brand.primary, 0.12) }]}
        >
          <Ionicons name="trophy-outline" size={14} color={theme.accentText} />
          <ThemedText type="small" style={{ color: theme.accentText }}>
            {RECORD_LABEL[kind]}
          </ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
  },
});
