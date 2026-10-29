import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { SPORT_TYPES } from '@/constants/activity';
import { SETUP_COPY } from '@/constants/copy';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { haptics } from '@/utils/haptics';
import { toggleSport } from '@/utils/preferredSports';

/** Pick the sports you do; they lead the Record shortcuts. */
export function SetupSportsStep({ onNext }: { onNext: () => void }) {
  const theme = useTheme();
  const saved = useSettingsStore((s) => s.preferredSports);
  const setPreferredSports = useSettingsStore((s) => s.setPreferredSports);
  const [picked, setPicked] = useState(saved);

  const next = () => {
    setPreferredSports(picked);
    onNext();
  };

  return (
    <>
      <View style={styles.grid}>
        {SPORT_TYPES.map((sport) => {
          const selected = picked.includes(sport.type);
          return (
            <Tappable
              key={sport.type}
              onPress={() => {
                haptics.selection();
                setPicked((current) => toggleSport(current, sport.type));
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={sport.label}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <Ionicons name={sport.icon} size={20} color={selected ? Brand.white : theme.text} />
              <ThemedText
                type="smallBold"
                style={{ color: selected ? Brand.white : theme.text }}
                numberOfLines={1}
              >
                {sport.label}
              </ThemedText>
            </Tappable>
          );
        })}
      </View>
      <AppButton onPress={next}>{SETUP_COPY.continue}</AppButton>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
