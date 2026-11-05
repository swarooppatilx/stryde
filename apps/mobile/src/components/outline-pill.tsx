import { StyleSheet, type ViewStyle } from 'react-native';
import { BorderRadius, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface OutlinePillProps {
  children: string;
  onPress(): void;
  /** Stretch across the container; otherwise the pill hugs its label. */
  fullWidth?: boolean;
  expanded?: boolean;
  style?: ViewStyle;
}

/** A secondary action: brand-coloured outline and label on the page background. */
export function OutlinePill({
  children,
  onPress,
  fullWidth = false,
  expanded,
  style,
}: OutlinePillProps) {
  const theme = useTheme();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={[
        styles.pill,
        fullWidth ? styles.full : styles.hug,
        { borderColor: theme.brand.primary },
        style,
      ]}
    >
      <ThemedText type="button" themeColor="accentText">
        {children}
      </ThemedText>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: Touch.target,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  full: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
});
