import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { LiquidMetal } from '@/components/liquid-metal';
import { Brand } from '@/constants/theme';

interface AchievementBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  /** Keep the shader animating - only turn on for a single emphasized badge (e.g. an unlock moment), never for a whole grid. */
  animated?: boolean;
}

export function AchievementBadge({ icon, size = 56, animated = false }: AchievementBadgeProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <LiquidMetal
        width={size}
        height={size}
        lightColor="#FFFFFF"
        darkColor={Brand.primaryPressed}
        paused={!animated}
        speed={0.4}
      />
      <Ionicons name={icon} size={size * 0.42} color={Brand.white} style={styles.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});
