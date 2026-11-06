import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SavePhase } from '@/services/postRun';
import { saveButtonLabel } from '@/utils/savePhase';

interface Props {
  canSave: boolean;
  isSaving: boolean;
  phase: SavePhase | undefined;
  onSave: () => void;
}

/** The Save button, pinned under the form so it is always in reach; it says what the save is doing. */
export function SaveFooter({ canSave, isSaving, phase, onSave }: Props) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}
    >
      <AppButton
        onPress={onSave}
        disabled={!canSave && !isSaving}
        loading={isSaving}
        accessibilityLabel={isSaving ? saveButtonLabel(true, phase) : 'Save activity'}
      >
        {saveButtonLabel(isSaving, phase)}
      </AppButton>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
