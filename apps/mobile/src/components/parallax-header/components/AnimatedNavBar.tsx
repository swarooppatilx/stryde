import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useAnimateNavbar } from '../hooks/useAnimatedNavBar';
import type { AnimatedNavbarProps } from '../types/index';

const AnimatedNavbar = ({
  scroll,
  imageHeight,
  OverflowHeaderComponent,
  TopNavbarComponent,
  headerHeight,
  headerElevation,
}: AnimatedNavbarProps) => {
  const [headerOpacity, overflowHeaderOpacity] = useAnimateNavbar(
    scroll,
    imageHeight,
    headerHeight
  );
  const [headerInteractive, setHeaderInteractive] = useState(false);
  const [overflowInteractive, setOverflowInteractive] = useState(true);

  useEffect(() => {
    // Opacity does not disable hit testing, so hidden bars must ignore touches.
    const collapseDistance = imageHeight - headerHeight;
    const listener = scroll.addListener(({ value }) => {
      setHeaderInteractive(value > collapseDistance * 0.75);
      setOverflowInteractive(value < collapseDistance);
    });
    return () => scroll.removeListener(listener);
  }, [scroll, imageHeight, headerHeight]);

  return (
    <>
      {TopNavbarComponent && (
        <Animated.View
          pointerEvents={headerInteractive ? 'box-none' : 'none'}
          style={[
            styles.container,
            {
              zIndex: headerOpacity,
              height: headerHeight,
              opacity: headerOpacity,
              elevation: headerElevation,
            },
          ]}
        >
          {TopNavbarComponent}
        </Animated.View>
      )}
      {OverflowHeaderComponent && (
        <Animated.View
          pointerEvents={overflowInteractive ? 'box-none' : 'none'}
          style={[
            styles.container,
            styles.overflowHeader,
            {
              zIndex: overflowHeaderOpacity,
              height: headerHeight,
              opacity: overflowHeaderOpacity,
            },
          ]}
        >
          {OverflowHeaderComponent}
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    width: '100%',
    backgroundColor: 'transparent',
  },
  overflowHeader: {
    backgroundColor: 'transparent',
  },
});

export default AnimatedNavbar;
