import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Springs } from '@/constants/motion';
import { Brand, Spacing } from '@/constants/theme';
import { clampPan, clampScale, shouldDismiss } from '@/utils/zoomMath';
import { ThemedText } from './themed-text';

const DOUBLE_TAP_SCALE = 2.5;

interface ZoomablePhotoProps {
  uri: string;
  width: number;
  height: number;
  /** Written while the photo is dragged vertically, so the viewer can fade its backdrop. */
  dragY: SharedValue<number>;
  onTap(): void;
  onDismiss(): void;
  accessibilityLabel: string;
}

/** One photo that pinches and double-taps to zoom, pans while zoomed, and drags away vertically to close. */
export function ZoomablePhoto({
  uri,
  width,
  height,
  dragY,
  onTap,
  onDismiss,
  accessibilityLabel,
}: ZoomablePhotoProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    baseScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clampScale(baseScale.value * event.scale);
    })
    .onEnd(() => {
      baseScale.value = scale.value;
      if (scale.value <= 1) resetZoom();
    });

  // Only while zoomed: at 1x the horizontal swipe belongs to the pager.
  const pan = Gesture.Pan()
    .onTouchesMove((_event, manager) => {
      if (scale.value <= 1) manager.fail();
    })
    .onStart(() => {
      baseX.value = x.value;
      baseY.value = y.value;
    })
    .onUpdate((event) => {
      x.value = clampPan(baseX.value + event.translationX, scale.value, width);
      y.value = clampPan(baseY.value + event.translationY, scale.value, height);
    });

  // Only at 1x: drag the photo up or down and let go to close.
  const dismiss = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-15, 15])
    .onTouchesMove((_event, manager) => {
      if (scale.value > 1) manager.fail();
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      if (shouldDismiss(event.translationY, event.velocityY)) {
        runOnJS(onDismiss)();
      } else {
        dragY.value = withSpring(0, Springs.photo);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        baseScale.value = DOUBLE_TAP_SCALE;
      }
    });
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => runOnJS(onTap)());

  const gesture = Gesture.Simultaneous(
    pinch,
    pan,
    dismiss,
    Gesture.Exclusive(doubleTap, singleTap)
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + dragY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, styles.page, style]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityLabel={accessibilityLabel}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('failed')}
        />
        {status === 'loading' && (
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <ActivityIndicator color={Brand.white} />
          </View>
        )}
        {status === 'failed' && (
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Ionicons name="image-outline" size={40} color={Brand.white} />
            <ThemedText type="small" style={styles.failed}>
              Couldn't load this photo
            </ThemedText>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  failed: { color: Brand.white, marginTop: Spacing.two },
});
