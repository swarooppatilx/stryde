import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  /** 0 to 1. */
  ratio: number;
  reached: boolean;
  size?: number;
}

const STROKE = 5;

/** A ring that fills clockwise from the top, with a tick in place of the percentage once it is full. */
export function ProgressRing({ ratio, reached, size = 48 }: Props) {
  const theme = useTheme();
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = reached ? theme.successText : theme.brand.primary;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.ring}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        {reached ? (
          <Ionicons name="checkmark" size={size * 0.42} color={color} />
        ) : (
          <ThemedText type="caption" themeColor="textSecondary">
            {Math.floor(ratio * 100)}%
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
  center: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
});
