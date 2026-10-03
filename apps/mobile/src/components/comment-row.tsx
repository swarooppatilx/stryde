import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deliveryLine, likeCountText } from '@/utils/commentUi';
import type { DeliveryState } from '@/utils/deliveryState';
import { formatRelativeTime } from '@/utils/format';

const AVATAR = 36;

interface CommentRowProps {
  name: string;
  avatarUri?: string;
  verified?: boolean;
  text: string;
  createdAt: Date;
  likes: number;
  liked: boolean;
  delivery?: DeliveryState;
  onLike(): void;
  onRetry(): void;
  /** Held down on the comment; left out for the athlete's own. */
  onLongPress?(): void;
}

/** One comment: avatar, a single-line name and time, the text, and a heart with its count on the right. */
export function CommentRow({
  name,
  avatarUri,
  verified,
  text,
  createdAt,
  likes,
  liked,
  delivery,
  onLike,
  onRetry,
  onLongPress,
}: CommentRowProps) {
  const theme = useTheme();
  const status = deliveryLine(delivery);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const likeColor = liked ? theme.brand.danger : theme.textSecondary;

  return (
    <Pressable
      style={styles.row}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityActions={
        onLongPress ? [{ name: 'longpress', label: 'Report comment' }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
    >
      <UserAvatar name={name} uri={avatarUri} size={AVATAR} />
      <View style={styles.body}>
        <View style={styles.header}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
            {name}
          </ThemedText>
          {verified ? (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={theme.brand.verified}
              accessibilityLabel="Verified account"
            />
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary" style={styles.time}>
            · {formatRelativeTime(createdAt, true)}
          </ThemedText>
        </View>
        <ThemedText type="small" selectable>
          {text}
        </ThemedText>
        {status ? (
          <Tappable
            onPress={status.failed ? onRetry : undefined}
            disabled={!status.failed}
            hitSlop={8}
            accessibilityRole={status.failed ? 'button' : 'text'}
          >
            <ThemedText type="caption" themeColor={status.failed ? 'dangerText' : 'textTertiary'}>
              {status.text}
            </ThemedText>
          </Tappable>
        ) : null}
      </View>
      <Tappable
        onPress={() => {
          pop.value = withSequence(withTiming(1.3, { duration: 90 }), withSpring(1));
          onLike();
        }}
        style={styles.like}
        accessibilityRole="button"
        accessibilityLabel={liked ? 'Unlike comment' : 'Like comment'}
        accessibilityState={{ selected: liked }}
      >
        <Animated.View style={popStyle}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={likeColor} />
        </Animated.View>
        <ThemedText type="caption" style={{ color: likeColor }}>
          {likeCountText(likes)}
        </ThemedText>
      </Tappable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  body: { flex: 1, gap: Spacing.half },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  name: { flexShrink: 1 },
  time: { flexShrink: 0 },
  like: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
