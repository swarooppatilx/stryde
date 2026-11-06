import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { type AccessibilityState, StyleSheet, View, type ViewStyle } from 'react-native';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { getSportIcon } from '@/constants/activity';
import { BorderRadius, IconSize, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import { parsePolyline } from '@/utils/format';

const COMPACT_THUMBNAIL = 64;
const CARD_THUMBNAIL = 120;
// RouteThumbnail draws at 600x240; the compact square is cut from its middle so the picture stays true.
const THUMBNAIL_ASPECT = 2.5;

interface ActivityRowProps {
  variant: 'compact' | 'card';
  title: string;
  meta: string;
  sport: ActivityType;
  /** The line to draw; without two points the sport icon shows instead. */
  polyline?: string;
  /** A chevron, privacy icon or selection box at the row's end. */
  trailing?: ReactNode;
  onPress?(): void;
  onLongPress?(): void;
  /** Marks a row as a saved route: a brand edge and tint set it apart from an activity. */
  saved?: boolean;
  style?: ViewStyle;
  accessibilityRole?: 'button' | 'checkbox';
  accessibilityState?: AccessibilityState;
  /** Spoken after the title and meta, e.g. who can see it. */
  accessibilitySuffix?: string;
}

/** One activity as a row: its line on a map (or the sport's icon), a title, one meta line, and a trailing slot. */
export function ActivityRow({
  variant,
  title,
  meta,
  sport,
  polyline,
  trailing,
  onPress,
  onLongPress,
  saved = false,
  style,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilitySuffix,
}: ActivityRowProps) {
  const theme = useTheme();
  const hasLine = parsePolyline(polyline ?? '').length >= 2;
  const compact = variant === 'compact';
  const size = compact ? COMPACT_THUMBNAIL : CARD_THUMBNAIL;

  const icon = (
    <View
      style={[styles.iconTile, { backgroundColor: tint(theme.brand.primary, 0.12), height: size }]}
    >
      <Ionicons
        name={getSportIcon(sport)}
        size={compact ? IconSize.action : IconSize.stat}
        color={theme.brand.primary}
      />
    </View>
  );

  const picture = hasLine ? (
    <RouteThumbnail polyline={polyline ?? ''} height={size} fallback={icon} />
  ) : (
    icon
  );

  return (
    <Tappable
      style={[
        compact ? styles.compact : styles.card,
        { backgroundColor: theme.backgroundElement },
        saved && { borderLeftWidth: Spacing.one, borderLeftColor: theme.brand.primary },
        style,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={[title, meta, accessibilitySuffix].filter(Boolean).join(', ')}
    >
      {compact ? (
        <View style={styles.compactThumbnail}>
          <View style={styles.compactCrop}>{picture}</View>
        </View>
      ) : (
        picture
      )}
      <View style={compact ? styles.compactBody : styles.cardBody}>
        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        </View>
        {trailing}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  compactThumbnail: {
    width: COMPACT_THUMBNAIL,
    height: COMPACT_THUMBNAIL,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  compactCrop: {
    width: COMPACT_THUMBNAIL * THUMBNAIL_ASPECT,
    marginLeft: -((COMPACT_THUMBNAIL * THUMBNAIL_ASPECT - COMPACT_THUMBNAIL) / 2),
  },
  iconTile: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  compactBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  text: { flex: 1, gap: Spacing.half },
});
