import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ACTIVITY_DESCRIPTION_MAX } from '@/constants/limits';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  description?: string;
  /** False for someone else's post: the note is shown, never edited, and no "Add" prompt appears. */
  editable?: boolean;
  /** The text being typed, or null while the description is only shown. */
  draft: string | null;
  onChangeDraft(text: string): void;
  onStartEdit(): void;
  onCancel(): void;
  onSave(): void;
}

/** An activity's free-text note: tap to edit in place, then save or cancel. */
export function ActivityDescription({
  description,
  editable = true,
  draft,
  onChangeDraft,
  onStartEdit,
  onCancel,
  onSave,
}: Props) {
  const theme = useTheme();

  if (!editable) {
    return description ? (
      <ThemedText type="small" style={styles.section}>
        {description}
      </ThemedText>
    ) : null;
  }

  if (draft === null) {
    return (
      <Tappable
        style={styles.section}
        onPress={onStartEdit}
        accessibilityRole="button"
        accessibilityLabel={description ? 'Edit the description' : 'Add a description'}
      >
        <ThemedText type="small" style={{ color: description ? theme.text : theme.textSecondary }}>
          {description || 'Add a description'}
        </ThemedText>
      </Tappable>
    );
  }

  return (
    <ThemedView style={styles.section}>
      <TextField
        value={draft}
        onChangeText={onChangeDraft}
        placeholder="How did it go?"
        maxLength={ACTIVITY_DESCRIPTION_MAX}
        multiline
        autoFocus
      />
      <ThemedView style={styles.actions}>
        <Tappable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing the description"
        >
          <ThemedText type="small" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Tappable>
        <Tappable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel="Save the description"
        >
          <ThemedText type="smallBold" style={{ color: theme.accentText }}>
            Save
          </ThemedText>
        </Tappable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.two },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.four },
});
