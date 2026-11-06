import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { AppButton } from '@/components/button';
import { PhotoPicker } from '@/components/photo-picker';
import { BasicsSection } from '@/components/save-activity/basics-section';
import { DetailsCard } from '@/components/save-activity/details-card';
import { FieldBlock } from '@/components/save-activity/field-block';
import { ManualEntrySection } from '@/components/save-activity/manual-entry-section';
import { PrivacyCard } from '@/components/save-activity/privacy-card';
import { RouteSummary } from '@/components/save-activity/route-summary';
import { SaveFooter } from '@/components/save-activity/save-footer';
import { SaveHeader } from '@/components/save-activity/save-header';
import { VisibilityCard } from '@/components/save-activity/visibility-card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import { PRIVATE_NOTE_MAX } from '@/constants/limits';
import { Spacing } from '@/constants/theme';
import { useSaveActivityForm } from '@/hooks/useSaveActivityForm';
import { showVisibilityControls } from '@/utils/saveActivityForm';

export default function CreateActivityScreen() {
  const form = useSaveActivityForm();
  const { recording } = form;
  const fromRecording = recording.isFromTracking;

  return (
    <ThemedView type="background" style={styles.container}>
      <SaveHeader onClose={form.handleBack} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {fromRecording && (
            <RouteSummary
              polyline={recording.polyline}
              activityType={form.activityType}
              distance={form.distance}
              duration={form.duration}
              territoryArea={recording.territoryArea}
              unitSystem={form.unitSystem}
            />
          )}
          {fromRecording && recording.noTerritory && GPS_DISTANCE_SPORTS.has(form.activityType) && (
            <ThemedText type="caption" themeColor="textSecondary">
              No territory this time. Loop back to where you started to claim the ground you cover.
            </ThemedText>
          )}

          <BasicsSection form={form} />
          {!fromRecording && <ManualEntrySection form={form} />}

          <PhotoPicker prominent photos={form.photos} onPhotosChange={form.setPhotos} />

          <DetailsCard form={form} />
          <PrivacyCard form={form} />
          {showVisibilityControls(form.privacy) && <VisibilityCard form={form} />}

          <FieldBlock label="Private note">
            <TextField
              value={form.privateNote}
              onChangeText={form.setPrivateNote}
              maxLength={PRIVATE_NOTE_MAX}
              placeholder="Only you can see this"
              multiline
            />
          </FieldBlock>

          <AppButton
            variant="dangerOutline"
            onPress={form.handleDiscard}
            disabled={form.isSaving}
            accessibilityLabel="Discard activity"
          >
            Discard activity
          </AppButton>
        </ScrollView>
        <SaveFooter
          canSave={form.canSave}
          isSaving={form.isSaving}
          phase={form.phase}
          onSave={form.handleSave}
        />
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.four },
});
