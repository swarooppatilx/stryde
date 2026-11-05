import { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Springs } from '@/constants/motion';
import { useVerticalSwipe } from '@/hooks/useVerticalSwipe';
import { haptics } from '@/utils/haptics';

/** Section that grows to its measured height: render unconstrained, attach `onLayout`, apply `style` to a clipping wrapper and `pan` to the toggle handle. */
export function useExpandableSection() {
  const [expanded, setExpandedState] = useState(false);
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(expanded ? 1 : 0, Springs.sheet);
  }, [expanded, progress]);

  const style = useAnimatedStyle(() => ({
    height: height * progress.value,
    opacity: progress.value,
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setHeight(event.nativeEvent.layout.height);
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    haptics.tap();
    setExpandedState(next);
  }, []);

  const pan = useVerticalSwipe(
    useCallback((direction: 'up' | 'down') => setExpanded(direction === 'up'), [setExpanded]),
    { distance: 15, velocity: 400 }
  );

  /** Collapses without feedback, e.g. when the session ends. */
  const reset = useCallback(() => setExpandedState(false), []);

  return { expanded, setExpanded, reset, style, onLayout, pan };
}
