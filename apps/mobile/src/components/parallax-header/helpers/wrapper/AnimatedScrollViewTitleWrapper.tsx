import type React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AnimatedScrollViewTitleProps } from '@/components/parallax-header/types';

export const AnimatedScrollViewTitleWrapper: React.FC<AnimatedScrollViewTitleProps> = ({
  children,
}): React.ReactNode => {
  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
});
