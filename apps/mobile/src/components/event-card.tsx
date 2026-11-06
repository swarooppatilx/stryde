import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { eventCoverColor } from '@/constants/sportColors';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

const COVER_HEIGHT = 112;
const COVER_OPACITY = 0.2;

interface EventCardProps {
  sport: ActivityType | 'multi';
  icon: keyof typeof Ionicons.glyphMap;
  /** A photo for the cover; the sport-coloured icon cover shows when there is none. */
  image?: ImageSource | number;
  title: string;
  /** Shown on the cover's corner, e.g. the start date. */
  badge: string;
  lines: readonly string[];
  onPress(): void;
  trailing?: ReactNode;
}

/** An event in the Groups list; events carry no picture on-chain, so the cover is a stock photo, or drawn from the sport without one. */
export function EventCard({
  sport,
  icon,
  image,
  title,
  badge,
  lines,
  onPress,
  trailing,
}: EventCardProps) {
  const theme = useTheme();
  const color = eventCoverColor(sport);
  return (
    <Tappable
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${badge}`}
    >
      <View style={[styles.cover, { backgroundColor: tint(color, COVER_OPACITY) }]}>
        {image ? (
          // Decorative: the title below names the event. Cropped from the middle, where faces tend to be.
          <Image
            source={image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessible={false}
          />
        ) : (
          <Ionicons name={icon} size={40} color={color} />
        )}
        <View style={[styles.badge, { backgroundColor: theme.backgroundSunken }]}>
          <ThemedText type="smallBold">{badge}</ThemedText>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.info}>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {title}
          </ThemedText>
          {lines.map((line, index) => (
            // Two equal lines (a one-day event whose start and end read the same) would share a key.
            <ThemedText
              key={`${index}-${line}`}
              type="caption"
              themeColor="textSecondary"
              numberOfLines={1}
            >
              {line}
            </ThemedText>
          ))}
        </View>
        {trailing}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  cover: { height: COVER_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  info: { flex: 1, gap: Spacing.half },
});
