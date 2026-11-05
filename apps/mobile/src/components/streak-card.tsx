import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Feed } from '@/constants/feed';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AppButton } from './button';
import { ThemedText } from './themed-text';

interface StreakCardProps {
  /** Consecutive weeks with an activity; the current week may still be empty. */
  weeks: number;
  /** Whether this week already has an activity, so no nudge is needed. */
  doneThisWeek: boolean;
  onRecord(): void;
}

/** The module at the top of Home: the current streak, or an invitation to start one. */
export function StreakCard({ weeks, doneThisWeek, onRecord }: StreakCardProps) {
  const theme = useTheme();
  const active = weeks > 0;
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <Ionicons
          name="flame"
          size={22}
          color={active ? theme.brand.primary : theme.disabled}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={styles.copy}>
          <ThemedText type="smallBold">
            {active ? `${weeks}-week streak` : 'Start a streak'}
          </ThemedText>
          {(!active || !doneThisWeek) && (
            <ThemedText type="caption" themeColor="textSecondary">
              {active ? 'Log an activity this week to keep it going' : 'Log an activity to start.'}
            </ThemedText>
          )}
        </View>
        <AppButton
          size="small"
          fullWidth={false}
          accessibilityLabel="Record now"
          onPress={onRecord}
        >
          Record
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: Spacing.two, paddingHorizontal: Feed.edge },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  copy: { flex: 1, gap: Spacing.half },
});
