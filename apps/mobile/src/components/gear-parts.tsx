import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { GEAR_NAME_MAX } from '@/constants/limits';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivityStore } from '@/stores/activityStore';
import { useGearStore } from '@/stores/gearStore';
import type { Gear } from '@/types';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { formatDistance, METERS_PER_MILE } from '@/utils/format';
import { componentStatus, componentUsage, parsePositive } from '@/utils/gearComponents';

const HOUR_MS = 3_600_000;

interface GearPartsProps {
  gear: Gear;
}

/** The parts of one gear item, each with its own budget counted from the day it was installed. */
export function GearParts({ gear }: GearPartsProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const activities = useActivityStore((s) => s.activities);
  const addComponent = useGearStore((s) => s.addComponent);
  const replaceComponent = useGearStore((s) => s.replaceComponent);
  const removeComponent = useGearStore((s) => s.removeComponent);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');

  const unitMeters = unitSystem === 'imperial' ? METERS_PER_MILE : 1000;
  const unitLabel = unitSystem === 'imperial' ? 'mi' : 'km';
  const distanceBudget = parsePositive(distance);
  const hoursBudget = parsePositive(hours);
  const canSave =
    name.trim().length > 0 && (distanceBudget !== undefined || hoursBudget !== undefined);

  const handleSave = () => {
    addComponent(gear.id, {
      name,
      installedAt: Date.now(),
      budgetDistance: distanceBudget === undefined ? undefined : distanceBudget * unitMeters,
      budgetTime: hoursBudget === undefined ? undefined : hoursBudget * HOUR_MS,
    });
    setName('');
    setDistance('');
    setHours('');
    setAdding(false);
  };

  return (
    <View style={styles.wrap}>
      {(gear.components ?? []).map((c) => {
        const usage = componentUsage(c, gear.id, activities);
        const { ratio, level } = componentStatus(c, usage);
        const percent = Math.round(ratio * 100);
        let color: string = theme.textSecondary;
        if (level === 'near') color = theme.warningText;
        if (level === 'over') color = Brand.danger;
        const budget =
          c.budgetDistance === undefined
            ? `${Math.round((c.budgetTime ?? 0) / HOUR_MS)} h`
            : formatDistance(c.budgetDistance, unitSystem);
        return (
          <View key={c.id} style={styles.part}>
            <View style={styles.partText}>
              <ThemedText type="small">{c.name}</ThemedText>
              <ThemedText type="small" style={{ color }}>
                {`${percent}% of ${budget}`}
              </ThemedText>
            </View>
            <Tappable
              onPress={() =>
                confirmDestructive({
                  title: `Replace ${c.name}?`,
                  message: 'Its count starts again from today. Your past activities are unchanged.',
                  confirmLabel: 'Replace',
                  cancelLabel: 'Keep',
                  onConfirm: () => replaceComponent(gear.id, c.id, Date.now()),
                })
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Replace ${c.name}`}
            >
              <ThemedText type="small" themeColor="textSecondary">
                Replace
              </ThemedText>
            </Tappable>
            <Tappable
              onPress={() =>
                confirmDestructive({
                  title: `Remove ${c.name}?`,
                  message: 'It stops being tracked. Your past activities are unchanged.',
                  confirmLabel: 'Remove',
                  cancelLabel: 'Keep',
                  onConfirm: () => removeComponent(gear.id, c.id),
                })
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${c.name}`}
            >
              <ThemedText type="small" themeColor="textSecondary">
                Remove
              </ThemedText>
            </Tappable>
          </View>
        );
      })}
      {adding ? (
        <View style={styles.form}>
          <TextField
            placeholder="Part, e.g. Chain"
            value={name}
            onChangeText={setName}
            maxLength={GEAR_NAME_MAX}
          />
          <TextField
            placeholder={`Lasts (${unitLabel}), optional`}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
          />
          <TextField
            placeholder="Lasts (hours), optional"
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
          />
          <AppButton disabled={!canSave} onPress={handleSave}>
            Add part
          </AppButton>
        </View>
      ) : (
        <Tappable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel={`Add a part to ${gear.name}`}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Add a part
          </ThemedText>
        </Tappable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.two },
  part: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  partText: { flex: 1 },
  form: { gap: Spacing.two },
});
