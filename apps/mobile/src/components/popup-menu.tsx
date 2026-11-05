import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import { type Box, popupMenuPosition } from '@/utils/popupPosition';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

export interface PopupMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress(): void;
}

const DEFAULT_MENU_WIDTH = 172;
const ROW_HEIGHT = 52;
const MENU_PADDING = Spacing.one;

interface PopupMenuProps {
  /** Where the button that opened the menu is on screen; null keeps the menu closed. */
  anchor: Box | null;
  items: readonly PopupMenuItem[];
  /** Menu width in dp; the default fits a short label like "Manual activity". */
  width?: number;
  onClose(): void;
  accessibilityLabel: string;
}

/**
 * A small dropdown that hangs off a button, like the "+" menu in a top bar: icon rows, no title
 * and no Cancel row, closed by tapping outside it or pressing Back.
 */
export function PopupMenu({
  anchor,
  items,
  width = DEFAULT_MENU_WIDTH,
  onClose,
  accessibilityLabel,
}: PopupMenuProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();
  if (!anchor) return null;

  const position = popupMenuPosition({
    anchor,
    window,
    menu: { width, height: items.length * ROW_HEIGHT + MENU_PADDING * 2 },
  });

  return (
    // statusBarTranslucent so the menu's coordinates match the window the button was measured in.
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(Motion.fast)}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.menu,
          theme.shadows.overlay,
          {
            backgroundColor: theme.backgroundOverlay,
            borderColor: theme.border,
            left: position.left,
            top: position.top,
            width,
          },
        ]}
      >
        {items.map((item) => (
          <Tappable
            key={item.key}
            style={styles.row}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
            onPress={() => {
              haptics.selection();
              onClose();
              item.onPress();
            }}
          >
            <Ionicons name={item.icon} size={22} color={theme.text} />
            <ThemedText type="default">{item.label}</ThemedText>
          </Tappable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    paddingVertical: MENU_PADDING,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: ROW_HEIGHT,
    paddingHorizontal: Spacing.three,
  },
});
