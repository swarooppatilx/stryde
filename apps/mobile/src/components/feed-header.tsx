import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feed } from '@/constants/feed';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Box } from '@/utils/popupPosition';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';
import { UserAvatar } from './user-avatar';

interface FeedHeaderProps {
  name: string;
  avatarUri?: string | null;
  /** Small glyph in front of the subtext, usually the sport. */
  subtextIcon: keyof typeof Ionicons.glyphMap;
  subtext: string;
  verified?: boolean;
  onPress(): void;
  /** Opens the card's menu, given where the button is so the menu can hang off it; the button is left out when there is nothing to offer. */
  onMore?(anchor: Box): void;
}

/** An athlete's avatar, name and one quiet line about the activity. */
export function FeedHeader({
  name,
  avatarUri,
  subtextIcon,
  subtext,
  verified,
  onPress,
  onMore,
}: FeedHeaderProps) {
  const theme = useTheme();
  const moreRef = useRef<View>(null);
  return (
    <View style={styles.outer}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}'s activity`}
        style={styles.row}
      >
        <UserAvatar name={name} uri={avatarUri} size={Feed.avatar} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <ThemedText type="sectionTitle" numberOfLines={1}>
              {name}
            </ThemedText>
            {verified ? (
              <Ionicons
                name="checkmark-circle"
                size={Feed.subtextIcon}
                color={theme.brand.verified}
                accessibilityLabel="Verified account"
              />
            ) : null}
          </View>
          <View style={styles.subtextRow}>
            <Ionicons name={subtextIcon} size={Feed.subtextIcon} color={theme.textSecondary} />
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              numberOfLines={2}
              style={styles.subtext}
            >
              {subtext}
            </ThemedText>
          </View>
        </View>
      </Tappable>
      {onMore ? (
        <View ref={moreRef} collapsable={false}>
          <Tappable
            onPress={() =>
              moreRef.current?.measureInWindow((x, y, width, height) =>
                onMore({ x, y, width, height })
              )
            }
            hitSlop={8}
            style={styles.more}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
          </Tappable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flexDirection: 'row', alignItems: 'flex-start' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Feed.edge,
    paddingTop: Feed.edge,
  },
  more: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Feed.edge - Spacing.one,
  },
  text: { flex: 1, gap: Spacing.half },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  subtextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  subtext: { flexShrink: 1 },
});
