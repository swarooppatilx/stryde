import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BorderRadius, Brand, IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type FollowState, locateIcon } from '@/utils/recordCamera';
import { ThemedText } from './themed-text';

interface RecordMapControlsProps {
  follow: FollowState;
  tilted: boolean;
  /** The map's bearing in degrees; the compass always shows and turns with the map. */
  bearing: number;
  /** How many optional layers are on; shown as a count on the layers button. */
  layersBadge?: number;
  /** Distance from the top of the screen to where the stack may start, below the stats island. */
  top: number;
  onLayers(): void;
  onToggleTilt(): void;
  onLocate(): void;
  onCompass(): void;
  /** Further controls that share the column, so they can never overlap the buttons above. */
  children?: ReactNode;
}

function locateLabel({ following, mode }: FollowState): string {
  if (!following) return 'Recenter map on me';
  return mode === 'north' ? 'Turn the map to face where I am heading' : 'Keep north at the top';
}

/** The stack of map buttons down the right side: layers, 3D, locate and the compass. */
export function RecordMapControls({
  follow,
  tilted,
  bearing,
  layersBadge = 0,
  top,
  onLayers,
  onToggleTilt,
  onLocate,
  onCompass,
  children,
}: RecordMapControlsProps) {
  const theme = useTheme();
  const button = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    active = false,
    rotation = 0,
    badge = 0
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[
        styles.button,
        { backgroundColor: active ? theme.brand.primary : theme.backgroundElement },
      ]}
    >
      <Ionicons
        name={icon}
        size={IconSize.inline}
        color={active ? theme.brand.white : theme.text}
        style={{ transform: [{ rotate: `${rotation}deg` }] }}
      />
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.brand.primary }]}>
          <ThemedText type="eyebrow" style={styles.badgeText}>
            {badge}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top }]}>
      {button(
        'layers-outline',
        layersBadge > 0 ? `Map layers, ${layersBadge} on` : 'Map layers',
        onLayers,
        false,
        0,
        layersBadge
      )}
      {button(
        'cube-outline',
        tilted ? 'Switch to flat map' : 'Switch to 3D map',
        onToggleTilt,
        tilted
      )}
      {button(locateIcon(follow), locateLabel(follow), onLocate)}
      {button('compass-outline', 'Turn the map north', onCompass, false, -bearing)}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    right: Spacing.three,
    gap: Spacing.two,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  button: {
    width: Touch.target,
    height: Touch.target,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Brand.white, fontSize: 11, lineHeight: 14 },
});
