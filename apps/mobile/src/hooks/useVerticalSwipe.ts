import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

/** Pan gesture for sheet handles: calls `onSwipe` once a drag passes `distance` or flings faster than `velocity`; small drags stay with the content below. */
export function useVerticalSwipe(
  onSwipe: (direction: 'up' | 'down') => void,
  { distance = 20, velocity = 500 }: { distance?: number; velocity?: number } = {}
) {
  return useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .onEnd((event) => {
          if (event.translationY < -distance || event.velocityY < -velocity) {
            runOnJS(onSwipe)('up');
          } else if (event.translationY > distance || event.velocityY > velocity) {
            runOnJS(onSwipe)('down');
          }
        }),
    [onSwipe, distance, velocity]
  );
}
