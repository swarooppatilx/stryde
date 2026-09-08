import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AnimatedScrollViewTitleProps } from '../../types';

export const AnimatedScrollViewTitleWrapper: React.FC<AnimatedScrollViewTitleProps> = ({
  children,
}): React.ReactNode => {
  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // This centers items vertically
    position: 'relative', // Make the container relative for absolute positioning
  },
});
