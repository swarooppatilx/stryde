import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { Feed } from '@/constants/feed';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Achievement } from '@/utils/achievements';
import { countOf } from '@/utils/plural';
import { ThemedText } from './themed-text';

const BADGE = 40;

/** A quiet line under an activity that earned something: the badge, what it was, and how many more. */
export function AchievementNotice({
  earned,
  onPress,
}: {
  earned: readonly Achievement[];
  /** Opens the page of the first badge earned. */
  onPress?: (badge: Achievement) => void;
}) {
  const theme = useTheme();
  const [first] = earned;
  if (!first) return null;
  const more = earned.length - 1;
  const label = `Earned ${earned.map((a) => a.title).join(', ')}`;
  return (
    <Tappable
      style={[styles.row, { backgroundColor: theme.backgroundSunken }]}
      onPress={onPress ? () => onPress(first) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label}. Open badge` : label}
    >
      <View style={[styles.badge, { backgroundColor: tint(first.color, 0.2) }]}>
        <Ionicons
          name={first.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={first.color}
        />
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {first.title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          {more > 0 ? `and ${countOf(more, 'more badge', 'more badges')}` : first.description}
        </ThemedText>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Feed.edge,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: Spacing.half },
});
