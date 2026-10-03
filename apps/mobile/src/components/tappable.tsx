import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

interface TappableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Opacity while pressed. */
  activeOpacity?: number;
}

/** A pressable that fades while pressed: the app's default tappable surface. */
export function Tappable({ style, activeOpacity = 0.7, ...rest }: TappableProps) {
  return (
    <Pressable style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]} {...rest} />
  );
}
