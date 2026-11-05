import { Ionicons } from '@expo/vector-icons';
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { type FollowState, locateIcon } from '@/utils/recordCamera';

interface Props {
  follow: FollowState;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
}

/** What tapping does next: come back to the athlete, or swap between north-up and heading-up. */
function labelFor({ following, mode }: FollowState): string {
  if (!following) return 'Recenter map on me';
  return mode === 'north' ? 'Turn the map to face where I am heading' : 'Keep north at the top';
}

/** The map's locate button: it shows how the map follows the athlete and changes it on each tap. */
export function LocateButton({ follow, onPress, style, iconColor }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={labelFor(follow)}
    >
      <Ionicons name={locateIcon(follow)} size={22} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
