import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { countOf } from '@/utils/plural';

interface FollowCountsProps {
  followers: number;
  /** Unknown for athletes whose follows have not been read yet. */
  following?: number;
  onOpen: (tab: 'followers' | 'following') => void;
}

/** "12 followers · 5 following", each opening its list. */
export function FollowCounts({ followers, following, onOpen }: FollowCountsProps) {
  const followersText = countOf(followers, 'follower', 'followers');
  const followingText = following === undefined ? 'Following' : `${following} following`;
  return (
    <View style={styles.row}>
      <Tappable
        onPress={() => onOpen('followers')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${followersText}, open list`}
      >
        <ThemedText themeColor="textSecondary">{followersText}</ThemedText>
      </Tappable>
      <ThemedText themeColor="textSecondary" accessibilityElementsHidden>
        ·
      </ThemedText>
      <Tappable
        onPress={() => onOpen('following')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${followingText}, open list`}
      >
        <ThemedText themeColor="textSecondary">{followingText}</ThemedText>
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
