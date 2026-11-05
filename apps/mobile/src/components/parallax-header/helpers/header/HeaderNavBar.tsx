import { BlurView } from 'expo-blur';
import React, { isValidElement } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HeaderNavBarProps } from '@/components/parallax-header/types';

export const HeaderNavBar: React.FC<HeaderNavBarProps> = ({
  children,
  headerHeight = 100,
  intensity = 50,
  tint = 'systemUltraThinMaterialDark',
  ...props
}) => {
  const { width } = useWindowDimensions();
  const childrenArray = React.Children.toArray(children).filter((child) => isValidElement(child));
  const childCount = childrenArray.length;

  const renderChildren = () => {
    if (childCount === 0) {
      return null;
    }

    if (childCount === 1) {
      return <View style={styles.centerContainer}>{childrenArray[0]}</View>;
    }

    if (childCount === 2) {
      return (
        <>
          <View style={styles.leftContainer}>{childrenArray[0]}</View>
          <View style={styles.rightContainer}>{childrenArray[1]}</View>
        </>
      );
    }

    if (childCount === 3) {
      return (
        <>
          <View style={styles.leftContainer}>{childrenArray[0]}</View>
          <View style={styles.centerContainer}>{childrenArray[1]}</View>
          <View style={styles.rightContainer}>{childrenArray[2]}</View>
        </>
      );
    }

    const leftItem = childrenArray[0];
    const rightItem = childrenArray[childCount - 1];
    const centerItems = childrenArray.slice(1, childCount - 1);

    return (
      <>
        <View style={styles.leftContainer}>{leftItem}</View>
        <View style={styles.centerContainer}>{centerItems}</View>
        <View style={styles.rightContainer}>{rightItem}</View>
      </>
    );
  };

  // expo-blur is unreliable on Android (OS version and GPU dependent). Without blur a transparent
  // header shows scrolled-past content, so a semi-opaque fallback in the same tint keeps it legible.
  const isDarkTint = tint.toLowerCase().includes('dark');
  const fallbackBackgroundColor = isDarkTint ? 'rgba(18,18,18,0.85)' : 'rgba(255,255,255,0.85)';

  return (
    <BlurView
      style={[
        styles.container,
        {
          width,
          height: headerHeight,
          backgroundColor: fallbackBackgroundColor,
        },
        props,
      ]}
      intensity={intensity}
      tint={tint}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>{renderChildren()}</View>
      </SafeAreaView>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
  },
  safeArea: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
