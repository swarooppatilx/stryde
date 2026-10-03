import { Ionicons } from '@expo/vector-icons';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
  dividerColor: string;
}

/** A compact zoom in / zoom out pair for the side of the map. */
export function ZoomControls({ onZoomIn, onZoomOut, style, iconColor, dividerColor }: Props) {
  return (
    <View style={[styles.pair, style]}>
      <Pressable
        onPress={onZoomIn}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
      >
        <Ionicons name="add" size={22} color={iconColor} />
      </Pressable>
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
      <Pressable
        onPress={onZoomOut}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
      >
        <Ionicons name="remove" size={22} color={iconColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: {
    position: 'absolute',
    right: Spacing.three,
    width: 44,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.two },
});
