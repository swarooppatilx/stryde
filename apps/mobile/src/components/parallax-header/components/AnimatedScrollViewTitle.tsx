import type React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { AnimatedScrollViewTitleProps } from '../types';

export const AnimatedScrollViewTitle: React.FC<AnimatedScrollViewTitleProps> = ({
  children,
  size,
  style,
}: AnimatedScrollViewTitleProps): React.ReactNode => {
  const { width } = useWindowDimensions();
  const maxWidth = 0.5 * width;

  return (
    <View
      style={[
        {
          ...styles.container,
        },
      ]}
    >
      <Text
        numberOfLines={2}
        style={[
          styles.text,
          {
            maxWidth: maxWidth,
            fontSize: size ? size : 35,
          },
          style,
        ]}
      >
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
  },
  text: {
    color: 'white',

    fontWeight: '700',

    textAlign: 'left',
  },
});
