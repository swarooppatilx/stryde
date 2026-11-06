import { StyleSheet, View } from 'react-native';
import { AppSwitch } from '@/components/app-switch';
import { FeelPicker } from '@/components/feel-picker';
import { GearPicker } from '@/components/gear-picker';
import { SegmentedChoice } from '@/components/segmented-choice';
import { ThemedText } from '@/components/themed-text';
import { EFFORT_OPTIONS } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import type { SaveActivityForm } from '@/hooks/useSaveActivityForm';
import type { ActivityEffort } from '@/types';
import { FieldBlock } from './field-block';
import { FormCard } from './form-card';

/** Gear, how it felt, how hard it was and whether it was a commute. */
export function DetailsCard({ form }: { form: SaveActivityForm }) {
  const { gearOptions, effort } = form;
  return (
    <FormCard title="Details">
      {gearOptions.length > 0 && (
        <FieldBlock label={form.activityType === 'ride' ? 'Bike' : 'Shoes'}>
          <GearPicker options={gearOptions} selected={form.gearId} onSelect={form.setGearId} />
        </FieldBlock>
      )}
      <FieldBlock label="How did it feel?">
        <FeelPicker selected={form.feel} onSelect={form.setFeel} />
      </FieldBlock>
      <FieldBlock label="How hard was it?">
        <SegmentedChoice<ActivityEffort>
          options={EFFORT_OPTIONS}
          selected={effort}
          onSelect={form.setEffort}
          onClear={() => form.setEffort(undefined)}
        />
        {effort && (
          <ThemedText type="caption" themeColor="textSecondary">
            {EFFORT_OPTIONS.find((o) => o.value === effort)?.description}
          </ThemedText>
        )}
      </FieldBlock>
      <View style={styles.switchRow}>
        <ThemedText style={styles.switchLabel}>This was a commute</ThemedText>
        <AppSwitch
          checked={form.isCommute}
          onChange={form.setIsCommute}
          label="This was a commute"
        />
      </View>
    </FormCard>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: { flex: 1 },
});
