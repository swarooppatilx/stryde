import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SPORT_TYPES } from '@/constants/activity';
import { SPORT_PICKER_COPY } from '@/constants/copy';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivityStore } from '@/stores/activityStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ActivityType } from '@/types';
import { haptics } from '@/utils/haptics';
import { shortcutSports } from '@/utils/topSports';
import { AppButton } from './button';
import { OutlinePill } from './outline-pill';
import { SportPickerSheet } from './sport-picker-sheet';
import { ThemedText } from './themed-text';

interface SportCardsProps {
  /** Called with the sport whose Start was pressed. */
  onStart(type: ActivityType): void;
  disabled: boolean;
}

/** Two shortcut cards for the sports the athlete reaches for most; the rest sit behind "More sports". */
export function SportCards({ onStart, disabled }: SportCardsProps) {
  const theme = useTheme();
  const history = useActivityStore((s) => s.activities);
  const [pickerOpen, setPickerOpen] = useState(false);
  const preferred = useSettingsStore((s) => s.preferredSports);
  const shortcuts = shortcutSports(history, preferred).flatMap((type) =>
    SPORT_TYPES.filter((sport) => sport.type === type)
  );

  const start = (type: ActivityType) => {
    haptics.impactHeavy();
    onStart(type);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cards}>
        {shortcuts.map((sport) => (
          <View key={sport.type} style={[styles.card, { backgroundColor: theme.backgroundSunken }]}>
            <View style={styles.cardHeader}>
              <Ionicons name={sport.icon} size={24} color={theme.text} />
              <ThemedText type="sectionTitle" style={styles.cardTitle}>
                {sport.label}
              </ThemedText>
            </View>
            <AppButton
              size="small"
              icon={<Ionicons name="play" size={18} color={Brand.white} />}
              accessibilityLabel={`Start ${sport.label}`}
              disabled={disabled}
              onPress={() => start(sport.type)}
            >
              Start
            </AppButton>
          </View>
        ))}
      </View>
      <OutlinePill fullWidth onPress={() => setPickerOpen(true)}>
        {SPORT_PICKER_COPY.more}
      </OutlinePill>
      <SportPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={start} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  cards: { gap: Spacing.one },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.three, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { flex: 1 },
});
