import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Springs } from '@/constants/motion';
import { useVerticalSwipe } from '@/hooks/useVerticalSwipe';
import { haptics } from '@/utils/haptics';

const MAX_SHEET_RATIO = 0.62;
const FALLBACK_HEADER_HEIGHT = 150;

/** Bottom sheet that springs between a collapsed header strip and a content-fitted height, capped so the map keeps some room. */
export function useCollapsibleSheet() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [expanded, setExpandedState] = useState(true);

  const maxHeight = windowHeight * MAX_SHEET_RATIO;
  const header = headerHeight || FALLBACK_HEADER_HEIGHT;
  const collapsedHeight = header + insets.bottom;
  const expandedHeight = Math.min(header + (bodyHeight || maxHeight) + insets.bottom, maxHeight);
  const visibleHeight = expanded ? expandedHeight : collapsedHeight;

  const height = useSharedValue(maxHeight);
  useEffect(() => {
    height.value = withSpring(visibleHeight, Springs.sheet);
  }, [visibleHeight, height]);
  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  const setExpanded = useCallback((next: boolean) => {
    haptics.tap();
    setExpandedState(next);
  }, []);

  // Pan only on the handle/header strip so it doesn't fight a ScrollView in the body.
  const pan = useVerticalSwipe(
    useCallback((direction: 'up' | 'down') => setExpanded(direction === 'up'), [setExpanded])
  );

  return {
    expanded,
    setExpanded,
    setHeaderHeight,
    setBodyHeight,
    /** Current target height; the map pads its camera by this. */
    visibleHeight,
    animatedStyle,
    pan,
  };
}
