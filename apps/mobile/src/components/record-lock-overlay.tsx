import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { createHoldTimer } from '@/utils/holdTimer';
import { ThemedText } from './themed-text';

const HOLD_MS = 1000;
const BAR_HEIGHT = 6;

/** Covers the recording screen so a pocket or a sweaty thumb cannot pause or stop it. Hold to unlock. */
export function RecordLockOverlay({ onUnlock }: { onUnlock(): void }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  // The screen re-renders every second while recording: a timer rebuilt on each render
  // would be cancelled before a one-second hold could finish.
  const latestOnUnlock = useRef(onUnlock);
  useEffect(() => {
    latestOnUnlock.current = onUnlock;
  });
  const hold = useMemo(
    () =>
      createHoldTimer({
        durationMs: HOLD_MS,
        onComplete: () => {
          haptics.success();
          latestOnUnlock.current();
        },
      }),
    []
  );
  useEffect(() => () => hold.cancel(), [hold]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  const press = () => {
    haptics.tap();
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    hold.start();
  };
  const release = () => {
    hold.cancel();
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: Motion.fast });
  };

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Ionicons name="lock-closed" size={40} color={Palette.white} />
      <ThemedText type="sectionTitle" style={styles.onScrim}>
        Screen locked
      </ThemedText>
      <Pressable
        onPressIn={press}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel="Hold to unlock"
        accessibilityHint="Press and hold for one second"
        style={[styles.hold, { borderColor: tint(Palette.white, 0.6) }]}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.bar, { backgroundColor: theme.brand.primary }, barStyle]} />
        </View>
        <ThemedText type="smallBold" style={styles.onScrim}>
          Hold to unlock
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tint(Palette.black, 0.78),
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    zIndex: 10,
  },
  // Always light: the scrim is dark in both themes.
  onScrim: { color: Palette.white },
  hold: {
    minWidth: 220,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  track: {
    alignSelf: 'stretch',
    height: BAR_HEIGHT,
    borderRadius: BorderRadius.full,
    backgroundColor: tint(Palette.white, 0.2),
    overflow: 'hidden',
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BorderRadius.full,
    transformOrigin: 'left',
  },
});
