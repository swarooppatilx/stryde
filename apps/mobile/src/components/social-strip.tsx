import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Feed } from '@/constants/feed';
import { useTheme } from '@/hooks/use-theme';
import { kudosLabel, kudosTapAction } from '@/utils/kudosAction';
import { Tappable } from './tappable';

interface SocialStripProps {
  hasKudoed: boolean;
  commentCount: number;
  /** The kudos could not be saved even after retrying; the icon says so. */
  kudosFailed?: boolean;
  kudosStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  /** Give kudos; once given, a long press takes them back. */
  onKudos(): void;
  /** Who gave kudos. A tap on a thumb that is already given opens this instead of taking the kudos back. */
  onSeeKudos(): void;
  onComment(): void;
  onShare(): void;
}

/** Three equal, icon-only buttons: kudos, comment, share. */
export function SocialStrip({
  hasKudoed,
  commentCount,
  kudosFailed = false,
  kudosStyle,
  onKudos,
  onSeeKudos,
  onComment,
  onShare,
}: SocialStripProps) {
  const theme = useTheme();
  const kudosedColor = hasKudoed ? theme.brand.primary : theme.text;
  const kudosColor = kudosFailed ? theme.dangerText : kudosedColor;
  return (
    <View style={styles.row}>
      <Tappable
        style={styles.button}
        onPress={kudosTapAction(kudosFailed, hasKudoed) === 'list' ? onSeeKudos : onKudos}
        onLongPress={hasKudoed ? onKudos : undefined}
        accessibilityRole="button"
        accessibilityLabel={kudosLabel(kudosFailed, hasKudoed)}
        accessibilityState={{ selected: hasKudoed }}
      >
        <Animated.View style={kudosStyle}>
          <Ionicons
            name={hasKudoed ? 'thumbs-up' : 'thumbs-up-outline'}
            size={Feed.socialIcon}
            color={kudosColor}
          />
        </Animated.View>
      </Tappable>
      <Tappable
        style={styles.button}
        onPress={onComment}
        accessibilityRole="button"
        accessibilityLabel={`Comments, ${commentCount} so far`}
      >
        <Ionicons name="chatbubble-outline" size={Feed.socialIcon} color={theme.text} />
      </Tappable>
      <Tappable
        style={styles.button}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share activity"
      >
        <Ionicons name="share-social-outline" size={Feed.socialIcon} color={theme.text} />
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  button: {
    flex: 1,
    minHeight: Feed.socialStrip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
