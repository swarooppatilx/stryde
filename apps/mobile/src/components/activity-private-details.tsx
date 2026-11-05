import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { EFFORT_OPTIONS } from '@/constants/activity';
import { BorderRadius, IconSize, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Activity } from '@/types';
import { routeHiddenNote } from '@/utils/privacyNotes';
import { ThemedText } from './themed-text';

interface Props {
  activity: Pick<Activity, 'effort' | 'isCommute' | 'privateNote' | 'hideRoute'>;
}

/** Owner-only details of an activity: effort, commute flag, private note and hidden-route notice. */
export function ActivityPrivateDetails({ activity }: Props) {
  const theme = useTheme();
  const effort = EFFORT_OPTIONS.find((option) => option.value === activity.effort);
  const chips = [effort?.label, activity.isCommute ? 'Commute' : undefined].filter(
    (label): label is string => !!label
  );
  // This block renders only on the owner's own activity page.
  const routeNote = routeHiddenNote({ isOwner: true, hideRoute: activity.hideRoute });
  if (chips.length === 0 && !activity.privateNote && !routeNote) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="lock-closed-outline" size={IconSize.badge} color={theme.textSecondary} />
        <ThemedText type="caption" themeColor="textSecondary">
          Only you can see this
        </ThemedText>
      </View>
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((label) => (
            <View
              key={label}
              style={[styles.chip, { backgroundColor: tint(theme.brand.primary, 0.12) }]}
            >
              <ThemedText type="small" style={{ color: theme.accentText }}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
      {!!activity.privateNote && <ThemedText type="small">{activity.privateNote}</ThemedText>}
      {!!routeNote && (
        <View style={styles.header} accessible accessibilityLabel={routeNote}>
          <Ionicons name="eye-off-outline" size={IconSize.badge} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary">
            {routeNote}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
  },
});
