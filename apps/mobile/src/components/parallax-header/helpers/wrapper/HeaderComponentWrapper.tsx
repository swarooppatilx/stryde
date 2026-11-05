import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { HeaderComponentWrapperProps } from '@/components/parallax-header/types';

export const HeaderComponentWrapper: React.FC<HeaderComponentWrapperProps> = ({
  children,
  useGradient,
  gradientColors,
  gradientHeight,
  ...props
}: HeaderComponentWrapperProps): React.ReactNode & React.JSX.Element => {
  return (
    <View style={[styles.container, props as ViewStyle]}>
      {children}
      {useGradient && (
        <LinearGradient
          colors={
            gradientColors?.[0] && gradientColors[1]
              ? [gradientColors[0], gradientColors[1], ...gradientColors.slice(2)]
              : ['transparent', 'transparent']
          }
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: gradientHeight,
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
