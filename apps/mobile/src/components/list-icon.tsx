import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ListIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
}

/** Plain monotone list icon - no tinted ring, just fixed-width alignment. */
export function ListIcon({ name, size = 18 }: ListIconProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Ionicons name={name} size={size} color={theme.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
});
