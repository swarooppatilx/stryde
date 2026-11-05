import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { AvatarStack } from '@/components/avatar-stack';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { activityKey, useSocialStore } from '@/stores/socialStore';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Kudos and comments on an activity, tap to read or add to the thread. Renders nothing until the feed knows the activity. */
export function ActivitySocialRow({ activityId, onOpen }: { activityId: string; onOpen(): void }) {
  const theme = useTheme();
  const social = useSocialStore((s) => s.activities[activityKey(s.activities, activityId)]);
  if (!social) return null;

  const label = `${plural(social.kudos.length, 'kudo', 'kudos')}, ${plural(social.comments.length, 'comment', 'comments')}`;
  return (
    <Tappable
      onPress={onOpen}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open comments`}
    >
      <Ionicons name="thumbs-up-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {social.kudos.length}
      </ThemedText>
      {social.kudos.length > 0 && <AvatarStack userIds={social.kudos} max={4} size={20} />}
      <ThemedView style={styles.spacer} />
      <Ionicons name="chatbubble-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {social.comments.length}
      </ThemedText>
      <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spacer: { flex: 1, backgroundColor: 'transparent' },
});
