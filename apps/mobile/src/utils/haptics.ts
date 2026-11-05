import { getPlatform } from '@/platform';

/** Haptic feedback named by intent; the device (or a test fake) decides how it feels. */
export const haptics = {
  tap: () => getPlatform().haptics.tap(),
  impactMedium: () => getPlatform().haptics.impactMedium(),
  impactHeavy: () => getPlatform().haptics.impactHeavy(),
  selection: () => getPlatform().haptics.selection(),
  success: () => getPlatform().haptics.success(),
  warning: () => getPlatform().haptics.warning(),
  error: () => getPlatform().haptics.error(),
};
