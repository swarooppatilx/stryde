import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { GearParts } from '@/components/gear-parts';
import { SegmentedChoice } from '@/components/segmented-choice';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GEAR_NAME_MAX } from '@/constants/limits';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { type TKey, useT } from '@/i18n';
import { useActivityStore } from '@/stores/activityStore';
import { useGearStore } from '@/stores/gearStore';
import type { GearKind } from '@/types';
import { confirmRetire } from '@/utils/confirmRetire';
import { formatDistance, METERS_PER_MILE } from '@/utils/format';
import { gearAlertLevel } from '@/utils/gearComponents';
import { gearMileage } from '@/utils/gearMileage';

const KIND_KEY: Record<GearKind, TKey> = { shoes: 'gear.kindShoes', bike: 'gear.kindBike' };
const KIND_ORDER: readonly GearKind[] = ['shoes', 'bike'];

/** Shoes and bikes kept on this device, with the distance each has covered. */
export default function GearScreen() {
  const t = useT();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const gear = useGearStore((s) => s.gear);
  const addGear = useGearStore((s) => s.addGear);
  const retireGear = useGearStore((s) => s.retireGear);
  const activities = useActivityStore((s) => s.activities);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<GearKind>('shoes');
  const [already, setAlready] = useState('');

  const unitMeters = unitSystem === 'imperial' ? METERS_PER_MILE : 1000;
  const startingValue = Number.parseFloat(already.replace(',', '.'));
  const canAdd = name.trim().length > 0;

  const handleAdd = () => {
    addGear({
      name,
      kind,
      startingDistance:
        Number.isFinite(startingValue) && startingValue > 0 ? startingValue * unitMeters : 0,
    });
    setName('');
    setAlready('');
  };

  const active = gear.filter((g) => !g.retired);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('healthImport.back')}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">{t('gear.title')}</ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {active.length === 0 && (
            <ThemedText themeColor="textSecondary">{t('gear.empty')}</ThemedText>
          )}
          {active.map((g) => {
            const alert = gearAlertLevel(g, activities);
            return (
              <View
                key={g.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}
              >
                <View style={styles.row}>
                  <Ionicons
                    name={g.kind === 'bike' ? 'bicycle' : 'footsteps'}
                    size={22}
                    color={theme.textSecondary}
                  />
                  <View style={styles.rowText}>
                    <ThemedText type="headline">{g.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDistance(gearMileage(g, activities), unitSystem)}
                    </ThemedText>
                    {alert !== 'ok' && (
                      <ThemedText
                        type="small"
                        style={{ color: alert === 'over' ? Brand.danger : theme.warningText }}
                      >
                        {alert === 'over' ? t('gear.partOver') : t('gear.partWorn')}
                      </ThemedText>
                    )}
                  </View>
                  <Tappable
                    onPress={() => confirmRetire(g.name, () => retireGear(g.id), t)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('gear.retireLabel', { name: g.name })}
                  >
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('gear.retire')}
                    </ThemedText>
                  </Tappable>
                </View>
                <GearParts gear={g} />
              </View>
            );
          })}

          <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.addLabel}>
            {t('gear.addHeading')}
          </ThemedText>
          <TextField
            placeholder={t('gear.namePlaceholder')}
            value={name}
            onChangeText={setName}
            maxLength={GEAR_NAME_MAX}
          />
          <SegmentedChoice<GearKind>
            options={KIND_ORDER.map((value) => ({ value, label: t(KIND_KEY[value]) }))}
            selected={kind}
            onSelect={setKind}
          />
          <TextField
            placeholder={t('gear.alreadyPlaceholder', {
              unit: unitSystem === 'imperial' ? 'mi' : 'km',
            })}
            value={already}
            onChangeText={setAlready}
            keyboardType="decimal-pad"
          />
          <AppButton disabled={!canAdd} onPress={handleAdd}>
            {t('gear.add')}
          </AppButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  spacer: { width: 24 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1 },
  addLabel: { marginTop: Spacing.three },
});
