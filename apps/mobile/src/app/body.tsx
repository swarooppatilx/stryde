import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { getPlatform } from '@/platform';
import {
  readBodyFromHealth,
  saveHeight,
  saveMaxHeartRate,
  saveRestingHeartRate,
  saveWeight,
  saveZoneFloors,
} from '@/services/bodyProfile';
import { useBodyStore } from '@/stores/bodyStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  fieldChanged,
  formatHeight,
  isUnparsedEntry,
  parseHeightCm,
  parseMaxHeartRate,
  parseRestingHeartRate,
  summariseBody,
  weightChange,
} from '@/utils/body';
import { formatWeight, parseWeightKg, weightRangeText } from '@/utils/calories';
import { formatDay, toCalendarDay } from '@/utils/dates';
import {
  DEFAULT_ZONE_FLOORS,
  parseZoneFloors,
  sameFloors,
  zoneFloorsToTexts,
} from '@/utils/heartRateZones';
import { Toast } from '@/utils/toast';

const HISTORY_SHOWN = 6;

const HEALTH_MESSAGES = {
  unavailable: 'Health Connect is not available on this phone',
  denied: 'No access to Health Connect. You can allow it in the Health Connect app.',
  empty: 'No weight or height found in Health Connect',
} as const;

const heightText = (cm: number, units: 'metric' | 'imperial') =>
  units === 'imperial' ? formatHeight(cm, 'imperial') : String(Math.round(cm));

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.figureText}>
        <ThemedText themeColor="textSecondary">{label}</ThemedText>
        {note ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/** Weight, height and what follows from them (BMI, resting energy, an estimated max heart rate), kept on this phone. */
function maxHeartRateNote(maxHeartRate: number | null, measured: boolean): string {
  if (maxHeartRate === null) return 'Needs your birthday, or enter your own';
  return measured ? 'Your own figure' : 'Estimate from your age';
}

export default function BodyScreen() {
  const theme = useTheme();
  const goBack = useGoBack();
  const router = useRouter();
  const units = useProfileStore((s) => s.settings.units);
  const storedWeight = useProfileStore((s) => s.settings.weightKg);
  const storedHeight = useProfileStore((s) => s.settings.heightCm);
  const storedMaxHr = useProfileStore((s) => s.settings.maxHeartRate);
  const storedRestingHr = useProfileStore((s) => s.settings.restingHeartRate);
  const birthday = useProfileStore((s) => s.birthday);
  const gender = useProfileStore((s) => s.gender);
  const entries = useBodyStore((s) => s.entries);

  const [weight, setWeight] = useState(storedWeight ? formatWeight(storedWeight, units) : '');
  const [height, setHeight] = useState(storedHeight ? heightText(storedHeight, units) : '');
  const [maxHr, setMaxHr] = useState(storedMaxHr ? String(storedMaxHr) : '');
  const [restingHr, setRestingHr] = useState(storedRestingHr ? String(storedRestingHr) : '');
  const storedFloors = useProfileStore((s) => s.settings.hrZoneFloors);
  const [floorTexts, setFloorTexts] = useState(zoneFloorsToTexts(storedFloors));
  const [reading, setReading] = useState(false);

  const weightKg = parseWeightKg(weight, units);
  const heightCm = parseHeightCm(height, units);
  const weightInvalid = isUnparsedEntry(weight, weightKg);
  const heightInvalid = isUnparsedEntry(height, heightCm);
  const maxHrValue = parseMaxHeartRate(maxHr);
  const maxHrInvalid = isUnparsedEntry(maxHr, maxHrValue);
  const restingHrValue = parseRestingHeartRate(restingHr);
  const restingHrInvalid = isUnparsedEntry(restingHr, restingHrValue);
  // The zone boundaries as typed; the usual ones are not "changed", and an odd set cannot be saved.
  const floorsValue = parseZoneFloors(floorTexts);
  const floorsInvalid = floorsValue === null;
  const floorsChanged =
    floorsValue !== null && !sameFloors(floorsValue, storedFloors ?? DEFAULT_ZONE_FLOORS);
  const changed =
    fieldChanged(weightKg, storedWeight) ||
    fieldChanged(heightCm, storedHeight) ||
    fieldChanged(maxHrValue, storedMaxHr) ||
    fieldChanged(restingHrValue, storedRestingHr) ||
    floorsChanged;
  const canSave =
    !weightInvalid &&
    !heightInvalid &&
    !maxHrInvalid &&
    !restingHrInvalid &&
    !floorsInvalid &&
    changed;

  const summary = useMemo(
    () =>
      summariseBody(
        {
          weightKg: weightKg ?? undefined,
          heightCm: heightCm ?? undefined,
          birthday,
          gender,
          maxHeartRate: maxHrValue ?? undefined,
        },
        new Date()
      ),
    [weightKg, heightCm, birthday, gender, maxHrValue]
  );
  const today = toCalendarDay(new Date());
  const month = weightChange(entries, 30, today);
  const recent = [...entries].reverse().slice(0, HISTORY_SHOWN);

  const save = () => {
    if (!canSave) return;
    if (fieldChanged(weightKg, storedWeight)) saveWeight(weightKg);
    if (fieldChanged(heightCm, storedHeight)) saveHeight(heightCm);
    if (fieldChanged(maxHrValue, storedMaxHr)) saveMaxHeartRate(maxHrValue);
    if (fieldChanged(restingHrValue, storedRestingHr)) saveRestingHeartRate(restingHrValue);
    if (floorsChanged && floorsValue) {
      saveZoneFloors(sameFloors(floorsValue, DEFAULT_ZONE_FLOORS) ? null : floorsValue);
    }
    Toast.success('Saved on this phone', 1.5);
  };

  // Fills the fields for the athlete to look over; nothing is saved until they press Save.
  const fillFromHealth = async () => {
    if (reading) return;
    setReading(true);
    try {
      const found = await readBodyFromHealth(getPlatform().health);
      if (found.status !== 'ok') {
        Toast.info(HEALTH_MESSAGES[found.status], 2.5);
        return;
      }
      if (found.weightKg !== undefined) setWeight(formatWeight(found.weightKg, units));
      if (found.heightCm !== undefined) setHeight(heightText(found.heightCm, units));
      if (found.restingHeartRate !== undefined) setRestingHr(String(found.restingHeartRate));
      Toast.info('Filled in from Health Connect. Press Save to keep it.', 2.5);
    } finally {
      setReading(false);
    }
  };

  const unitWord = units === 'imperial' ? 'lb' : 'kg';

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            Body
          </ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            Used for calories, resting energy and heart-rate estimates. It stays on this phone and
            is never published.
          </ThemedText>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {`Weight (${unitWord})`}
            </ThemedText>
            <TextField
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="Optional"
              maxLength={6}
              error={weightInvalid ? `Enter a weight ${weightRangeText(units)}` : null}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {units === 'imperial' ? 'Height (ft′ in″)' : 'Height (cm)'}
            </ThemedText>
            <TextField
              value={height}
              onChangeText={setHeight}
              keyboardType="numbers-and-punctuation"
              placeholder={units === 'imperial' ? `Optional, e.g. 5'10` : 'Optional, e.g. 175'}
              maxLength={7}
              error={heightInvalid ? 'Enter a height between 100 and 250 cm' : null}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Max heart rate (bpm)
            </ThemedText>
            <TextField
              value={maxHr}
              onChangeText={setMaxHr}
              keyboardType="number-pad"
              placeholder="Optional, replaces the estimate from your age"
              maxLength={3}
              error={maxHrInvalid ? 'Enter a number between 120 and 230' : null}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Resting heart rate (bpm)
            </ThemedText>
            <TextField
              value={restingHr}
              onChangeText={setRestingHr}
              keyboardType="number-pad"
              placeholder="Optional, makes heart-rate zones more accurate"
              maxLength={3}
              error={restingHrInvalid ? 'Enter a number between 30 and 120' : null}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Heart-rate zone boundaries (% where zones 2 to 5 begin)
            </ThemedText>
            <View style={styles.zoneRow}>
              {floorTexts.map((text, i) => (
                <View key={`zone-${i + 2}`} style={styles.zoneField}>
                  <TextField
                    value={text}
                    onChangeText={(next) =>
                      setFloorTexts((current) => current.map((t, j) => (j === i ? next : t)))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    accessibilityLabel={`Zone ${i + 2} starts at percent of your maximum`}
                  />
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.zoneLabel}>
                    {`Zone ${i + 2}`}
                  </ThemedText>
                </View>
              ))}
            </View>
            {floorsInvalid ? (
              <ThemedText type="caption" style={{ color: theme.dangerText }}>
                Four whole numbers from 30 to 99, each higher than the one before.
              </ThemedText>
            ) : null}
            <Tappable
              onPress={() => setFloorTexts(zoneFloorsToTexts(undefined))}
              accessibilityRole="button"
              accessibilityLabel="Use the usual zone boundaries"
              hitSlop={8}
            >
              <ThemedText type="small" style={{ color: theme.accentText }}>
                Use the usual boundaries
              </ThemedText>
            </Tappable>
          </ThemedView>

          <AppButton onPress={save} disabled={!canSave}>
            Save
          </AppButton>
          <Tappable
            onPress={fillFromHealth}
            disabled={reading}
            accessibilityRole="button"
            accessibilityLabel="Fill weight, height and resting heart rate from Health Connect"
            hitSlop={8}
          >
            <ThemedText type="small" style={{ color: theme.accentText }}>
              Fill from Health Connect
            </ThemedText>
          </Tappable>

          <Card style={styles.card}>
            <ThemedText type="sectionTitle">Your figures</ThemedText>
            <Figure
              label="BMI"
              value={summary.bmi === null ? '—' : String(summary.bmi)}
              note={summary.bmiBand ?? 'Needs weight and height'}
            />
            <Figure
              label="Resting energy"
              value={summary.basalCalories === null ? '—' : `${summary.basalCalories} kcal/day`}
              note={
                summary.basalCalories === null
                  ? 'Needs weight, height and birthday'
                  : 'Estimate for a day at rest'
              }
            />
            <Figure
              label="Max heart rate"
              value={summary.maxHeartRate === null ? '—' : `${summary.maxHeartRate} bpm`}
              note={maxHeartRateNote(summary.maxHeartRate, summary.maxHeartRateMeasured)}
            />
            {summary.age === null || gender === 'prefer_not_to_say' ? (
              <Tappable
                onPress={() => router.push('/profile-edit')}
                accessibilityRole="link"
                accessibilityLabel="Add your birthday and gender in Edit profile"
                hitSlop={8}
              >
                <ThemedText type="small" style={{ color: theme.accentText }}>
                  Add your birthday and gender for better estimates
                </ThemedText>
              </Tappable>
            ) : null}
            <ThemedText type="caption" themeColor="textTertiary">
              These are rough population estimates, not medical advice.
            </ThemedText>
          </Card>

          {recent.length > 0 ? (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Weight history</ThemedText>
              {month !== null && (
                <ThemedText type="small" themeColor="textSecondary">
                  {`${month > 0 ? '+' : ''}${(units === 'imperial' ? month / 0.45359237 : month).toFixed(1)} ${unitWord} in the last 30 days`}
                </ThemedText>
              )}
              {recent.map((entry) => (
                <Figure
                  key={entry.day}
                  label={formatDay(new Date(`${entry.day}T12:00:00`))}
                  value={`${formatWeight(entry.kg, units)} ${unitWord}`}
                />
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  zoneRow: { flexDirection: 'row', gap: Spacing.two },
  zoneField: { flex: 1, gap: Spacing.half },
  zoneLabel: { textAlign: 'center' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  spacer: { width: 24 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  field: { gap: Spacing.two },
  card: { gap: Spacing.two },
  figure: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  figureText: { flex: 1 },
});
