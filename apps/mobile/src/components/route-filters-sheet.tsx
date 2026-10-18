import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { type DistanceFilter, MEDIUM_MAX, SHORT_MAX } from '@/utils/distanceFilter';
import { formatDistance, formatElevation } from '@/utils/format';
import { type ElevationFilter, FLAT_MAX, ROLLING_MAX } from '@/utils/routeDifficulty';
import type { RouteFilters } from '@/utils/routeLibrary';

interface RouteFiltersSheetProps {
  visible: boolean;
  onClose(): void;
  filters: RouteFilters;
  onChange(next: RouteFilters): void;
  sportOptions: Array<{ value: string; label: string }>;
}

const DIFFICULTY_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
] as const;

/** Sport, distance, climb and difficulty in one sheet, so the list is not buried under chip rows. */
export function RouteFiltersSheet({
  visible,
  onClose,
  filters,
  onChange,
  sportOptions,
}: RouteFiltersSheetProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const unitSystem = useUnitSystem();

  const distanceOptions: Array<{ value: DistanceFilter; label: string }> = [
    { value: 'any', label: 'Any distance' },
    { value: 'short', label: `Under ${formatDistance(SHORT_MAX, unitSystem)}` },
    {
      value: 'medium',
      label: `${formatDistance(SHORT_MAX, unitSystem)} to ${formatDistance(MEDIUM_MAX, unitSystem)}`,
    },
    { value: 'long', label: `Over ${formatDistance(MEDIUM_MAX, unitSystem)}` },
  ];
  const elevationOptions: Array<{ value: ElevationFilter; label: string }> = [
    { value: 'any', label: 'Any climb' },
    { value: 'flat', label: `Flat, under ${formatElevation(FLAT_MAX, unitSystem)}` },
    { value: 'rolling', label: `Rolling, to ${formatElevation(ROLLING_MAX, unitSystem)}` },
    { value: 'hilly', label: `Hilly, over ${formatElevation(ROLLING_MAX, unitSystem)}` },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close filters"
      />
      <View style={styles.anchor} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundElement, paddingBottom: bottom + Spacing.two },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <ThemedText type="sectionTitle" style={styles.title}>
            Filter routes
          </ThemedText>
          <ScrollView contentContainerStyle={styles.content}>
            <Section title="Sport">
              <ChipRow
                options={sportOptions}
                value={filters.sport}
                onChange={(sport) => onChange({ ...filters, sport })}
                contentStyle={styles.chips}
              />
            </Section>
            <Section title="Distance">
              <ChipRow
                options={distanceOptions}
                value={filters.distance}
                onChange={(distance) => onChange({ ...filters, distance })}
                contentStyle={styles.chips}
              />
            </Section>
            <Section title="Climb">
              <ChipRow
                options={elevationOptions}
                value={filters.elevation ?? 'any'}
                onChange={(elevation) => onChange({ ...filters, elevation })}
                contentStyle={styles.chips}
              />
            </Section>
            <Section title="Difficulty">
              <ChipRow
                options={DIFFICULTY_OPTIONS}
                value={filters.difficulty ?? 'any'}
                onChange={(difficulty) => onChange({ ...filters, difficulty })}
                contentStyle={styles.chips}
              />
            </Section>
          </ScrollView>
          <View style={styles.actions}>
            <AppButton
              variant="secondary"
              onPress={() =>
                onChange({
                  ...filters,
                  sport: 'all',
                  distance: 'any',
                  elevation: 'any',
                  difficulty: 'any',
                })
              }
            >
              Reset
            </AppButton>
            <AppButton onPress={onClose}>Done</AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  title: { paddingHorizontal: Spacing.four },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  content: { gap: Spacing.three, paddingVertical: Spacing.two },
  section: { gap: Spacing.two },
  sectionTitle: { paddingHorizontal: Spacing.four },
  chips: { paddingHorizontal: Spacing.four },
  actions: { gap: Spacing.two, paddingHorizontal: Spacing.four },
});
