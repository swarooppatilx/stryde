import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useToastStore } from '@/stores/toastStore';
import type { ToastItem } from '@/utils/toastStack';

const ICONS = {
  info: 'information-circle' as const,
  success: 'checkmark-circle' as const,
  fail: 'close-circle' as const,
  loading: null,
};

/** How far a toast must travel sideways (or how fast) before letting go dismisses it. */
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;
const OFFSCREEN = 480;
const ENTER_OFFSET = -16;

function toastAccent(kind: ToastItem['kind'], theme: ReturnType<typeof useTheme>): string {
  if (kind === 'success') return theme.brand.success;
  return kind === 'fail' ? theme.brand.danger : theme.brand.primary;
}

function ToastCard({ item }: { item: ToastItem }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const remove = useToastStore((s) => s.remove);
  const finalize = useToastStore((s) => s.finalize);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(reduceMotion ? 0 : ENTER_OFFSET);
  const { key, exiting, onPress } = item;
  const duration = reduceMotion ? 0 : Motion.fast;

  useEffect(() => {
    if (exiting) {
      if (duration === 0) {
        finalize(key);
        return;
      }
      opacity.value = withTiming(0, { duration }, (done) => {
        if (done) runOnJS(finalize)(key);
      });
      return;
    }
    opacity.value = withTiming(1, { duration });
    translateY.value = withTiming(0, { duration });
  }, [exiting, duration, key, finalize, opacity, translateY]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > DISMISS_DISTANCE;
      const fast = Math.abs(e.velocityX) > DISMISS_VELOCITY;
      if (far || fast) {
        const direction = e.translationX < 0 ? -1 : 1;
        translateX.value = withTiming(direction * OFFSCREEN, { duration }, (done) => {
          if (done) runOnJS(remove)(key);
        });
        if (duration === 0) runOnJS(remove)(key);
      } else {
        translateX.value = withTiming(0, { duration });
      }
    });

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success && onPress) runOnJS(onPress)();
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (1 - Math.min(1, Math.abs(translateX.value) / OFFSCREEN)),
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const accentColor = toastAccent(item.kind, theme);

  const actions = [
    { name: 'dismiss', label: 'Dismiss' },
    ...(onPress ? [{ name: 'activate' }] : []),
  ];

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityRole={onPress ? 'button' : 'alert'}
        accessibilityLabel={item.content}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'dismiss') remove(key);
          else if (e.nativeEvent.actionName === 'activate') onPress?.();
        }}
        style={[
          styles.toast,
          theme.shadows.overlay,
          {
            backgroundColor: theme.backgroundOverlay,
            borderColor: theme.border,
          },
          animatedStyle,
        ]}
      >
        {item.kind === 'loading' ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <Ionicons name={ICONS[item.kind]} size={20} color={accentColor} />
        )}
        <ThemedText type="small" style={styles.text} numberOfLines={2}>
          {item.content}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

/** Mounted once at the app root; draws up to three active `@/utils/toast` toasts, newest on top. */
export function ToastHost() {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;
  const newestFirst = [...items].reverse();
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.stack}>
        {newestFirst.map((item) => (
          <ToastCard key={item.key} item={item} />
        ))}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  stack: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '92%',
  },
  text: {
    flexShrink: 1,
  },
});
