import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { HeaderComponentWrapperProps } from '../../types';

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
            gradientColors && gradientColors.length >= 2
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

      {/* <LinearGradient
        colors={["transparent", "black"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 400,
        }}
      /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
