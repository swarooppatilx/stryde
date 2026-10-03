import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Tappable } from './tappable';

const ICON_SIZE = 28;

interface TopBarActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress(): void;
  /** Drawn over the icon, e.g. an unread count. */
  children?: ReactNode;
}

/** An outline icon button for a tab's top bar. */
export function TopBarAction({ icon, label, onPress, children }: TopBarActionProps) {
  const theme = useTheme();
  return (
    <Tappable
      style={styles.button}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Ionicons name={icon} size={ICON_SIZE} color={theme.text} />
      {children}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
