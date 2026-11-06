import { SportField } from '@/components/sport-field';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { SIMULATED_LOCATION_NOTICE } from '@/constants/copy';
import { ACTIVITY_DESCRIPTION_MAX } from '@/constants/limits';
import { useTheme } from '@/hooks/use-theme';
import type { SaveActivityForm } from '@/hooks/useSaveActivityForm';
import { FieldBlock } from './field-block';

/** Title, sport and description, plus the note that a simulated location was used. */
export function BasicsSection({ form }: { form: SaveActivityForm }) {
  const theme = useTheme();
  return (
    <>
      {form.recording.mocked && (
        <ThemedText type="caption" style={{ color: theme.warningText }}>
          {SIMULATED_LOCATION_NOTICE}
        </ThemedText>
      )}
      <FieldBlock label="Title">
        <TextField
          value={form.title}
          onChangeText={form.setTitleInput}
          placeholder={form.defaultTitle}
        />
      </FieldBlock>
      <SportField value={form.activityType} onChange={form.setActivityType} />
      <FieldBlock label="Description">
        <TextField
          value={form.description}
          onChangeText={form.setDescription}
          maxLength={ACTIVITY_DESCRIPTION_MAX}
          placeholder="Add a description"
          multiline
        />
      </FieldBlock>
    </>
  );
}
