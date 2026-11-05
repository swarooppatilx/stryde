import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';

const SHAKE_DISTANCE = Spacing.two;
const SHAKE_RELEASE_MS = 40;

/** Sideways shake with an error buzz; under reduced motion only the buzz remains. */
export function useShake() {
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const shake = useCallback(() => {
    haptics.error();
    if (reduceMotion) return;
    offset.value = withSequence(
      withTiming(-SHAKE_DISTANCE, { duration: SHAKE_RELEASE_MS }),
      withSpring(0)
    );
  }, [reduceMotion, offset]);

  return { style, shake };
}
