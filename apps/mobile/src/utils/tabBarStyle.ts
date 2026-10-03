import { StyleSheet } from 'react-native';
import { TabBar } from '@/constants/tabBar';

/**
 * The tab bar's surface and size, shared so a screen that hides and restores it brings back the same
 * look. `bottomInset` is the system navigation inset: the height and bottom padding both include it.
 */
export function tabBarStyle(colors: { navbar: string; border: string }, bottomInset = 0) {
  return {
    backgroundColor: colors.navbar,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: TabBar.paddingTop,
    paddingBottom: TabBar.paddingBottom + bottomInset,
    height: TabBar.baseHeight + TabBar.paddingTop + TabBar.paddingBottom + bottomInset,
  };
}
