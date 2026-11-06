import { StyleSheet, View } from 'react-native';
import { AppSwitch } from '@/components/app-switch';
import { SegmentedChoice } from '@/components/segmented-choice';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_CHOICES } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import type { SaveActivityForm } from '@/hooks/useSaveActivityForm';
import type { ActivityPrivacy } from '@/types';
import { privacyOptionDescription } from '@/utils/privacyNotes';
import { showHideRoute } from '@/utils/saveActivityForm';
import { FormCard } from './form-card';

/** Who can see the activity, and whether the route map is kept from them. */
export function PrivacyCard({ form }: { form: SaveActivityForm }) {
  const { privacy, privacyCaption } = form;
  return (
    <FormCard title="Privacy">
      <SegmentedChoice<ActivityPrivacy>
        fill
        options={PRIVACY_CHOICES}
        selected={privacy}
        onSelect={form.selectPrivacy}
      />
      <ThemedText type="caption" themeColor="textSecondary">
        {privacyOptionDescription(privacy)}
      </ThemedText>
      {!!privacyCaption && (
        <ThemedText type="caption" themeColor="textSecondary">
          {privacyCaption}
        </ThemedText>
      )}
      {showHideRoute(form.recording.isFromTracking, privacy) && (
        <View style={styles.hideRoute}>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Hide the route map from others</ThemedText>
            <AppSwitch
              checked={form.hideRoute}
              onChange={form.setHideRoute}
              label="Hide the route map from others"
            />
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Your stats and photos still show. The route stays on this phone and no territory is
            claimed.
          </ThemedText>
        </View>
      )}
    </FormCard>
  );
}

const styles = StyleSheet.create({
  hideRoute: { gap: Spacing.two },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: { flex: 1 },
});
