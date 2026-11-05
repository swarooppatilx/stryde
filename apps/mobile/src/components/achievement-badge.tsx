import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

interface AchievementBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
}

/** A badge earned: a solid brand disc with its icon. Plain on purpose; the grid shows several at once. */
export function AchievementBadge({ icon, size = 56 }: AchievementBadgeProps) {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: Brand.primary },
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={Brand.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
