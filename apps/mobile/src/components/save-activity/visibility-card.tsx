import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppSwitch } from '@/components/app-switch';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SaveActivityForm } from '@/hooks/useSaveActivityForm';
import { hiddenDetailsSummary } from '@/utils/saveActivityForm';
import { FormCard } from './form-card';
import { HiddenDetailsSheet } from './hidden-details-sheet';

const MUTE_LABEL = "Don't publish to Home or Club feeds";

/** Keeping an activity out of other people's feeds, and figures out of what they see. */
export function VisibilityCard({ form }: { form: SaveActivityForm }) {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <FormCard title="Visibility">
      <View style={styles.block}>
        <View style={styles.row}>
          <ThemedText style={styles.label}>{MUTE_LABEL}</ThemedText>
          <AppSwitch checked={form.muted} onChange={form.setMuted} label={MUTE_LABEL} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          It still shows on your profile.
        </ThemedText>
      </View>
      <Tappable
        style={styles.row}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Hidden details, ${hiddenDetailsSummary(form.hiddenStats)}`}
      >
        <ThemedText style={styles.label}>Hidden details</ThemedText>
        <ThemedText themeColor="textSecondary">{hiddenDetailsSummary(form.hiddenStats)}</ThemedText>
        <Ionicons name="chevron-forward" size={IconSize.badge} color={theme.textSecondary} />
      </Tappable>
      <HiddenDetailsSheet
        visible={sheetOpen}
        hidden={form.hiddenStats}
        onChange={form.setHiddenStat}
        onClose={() => setSheetOpen(false)}
      />
    </FormCard>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  label: { flex: 1 },
});
