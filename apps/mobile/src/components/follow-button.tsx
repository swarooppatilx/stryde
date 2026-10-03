import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSocialStore } from '@/stores/socialStore';
import { confirmUnfollow } from '@/utils/confirmUnfollow';
import { haptics } from '@/utils/haptics';

interface FollowButtonProps {
  userId: string;
  /** Used in the accessibility label and the unfollow confirmation. */
  name: string;
}

/** Compact follow control for list rows. Unfollowing asks first so a stray tap can't undo a follow. */
export function FollowButton({ userId, name }: FollowButtonProps) {
  const theme = useTheme();
  const following = useSocialStore((s) => s.following.has(userId.toLowerCase()));
  const toggleFollow = useSocialStore((s) => s.toggleFollow);

  const onPress = () => {
    if (!following) {
      haptics.impactMedium();
      void toggleFollow(userId);
      return;
    }
    confirmUnfollow(name, () => {
      haptics.impactMedium();
      void toggleFollow(userId);
    });
  };

  return (
    <Tappable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow ${name}` : `Follow ${name}`}
      accessibilityState={{ selected: following }}
      style={[
        styles.button,
        following
          ? { borderColor: theme.border, borderWidth: 1 }
          : { backgroundColor: theme.brand.primary },
      ]}
    >
      <ThemedText
        type="smallBold"
        style={{ color: following ? theme.text : Brand.white }}
        numberOfLines={1}
      >
        {following ? 'Following' : 'Follow'}
      </ThemedText>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 92,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
