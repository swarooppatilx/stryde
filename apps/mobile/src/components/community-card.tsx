import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface CardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  lines: readonly string[];
  onPress(): void;
  /** Right-hand slot; a chevron when omitted. */
  trailing?: ReactNode;
}

/** One row in the Groups lists: clubs, events and challenges. */
export function CommunityCard({ icon, title, lines, onPress, trailing }: CardProps) {
  const theme = useTheme();
  // A blank line (a club with no location) would leave an empty row, and two equal lines would share a key.
  const shown = lines.filter((line) => line.trim() !== '');
  return (
    <Tappable
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[title, ...shown].join('. ')}
    >
      <ThemedView style={styles.row}>
        <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
          <Ionicons name={icon} size={22} color={theme.brand.primary} />
        </ThemedView>
        <ThemedView style={styles.info}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {title}
          </ThemedText>
          {shown.map((line, index) => (
            <ThemedText
              key={`${index}-${line}`}
              type="caption"
              themeColor="textSecondary"
              numberOfLines={1}
            >
              {line}
            </ThemedText>
          ))}
        </ThemedView>
        {trailing ?? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
      </ThemedView>
    </Tappable>
  );
}

interface JoinButtonProps {
  joined: boolean;
  pending: boolean;
  disabled?: boolean;
  /** What is being joined, for screen readers. */
  name: string;
  onPress(): void;
}

export function JoinButton({ joined, pending, disabled, name, onPress }: JoinButtonProps) {
  const theme = useTheme();
  const textColor = joined ? theme.textSecondary : Brand.white;
  return (
    <Tappable
      style={[
        styles.joinBtn,
        {
          backgroundColor: joined ? 'transparent' : theme.brand.primary,
          borderColor: joined ? theme.border : theme.brand.primary,
        },
      ]}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      activeOpacity={0.7}
      disabled={pending || disabled}
      accessibilityRole="button"
      accessibilityLabel={joined ? `Leave ${name}` : `Join ${name}`}
    >
      {pending ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <ThemedText type="small" style={{ color: textColor, fontWeight: '600' }}>
          {joined ? 'Joined' : 'Join'}
        </ThemedText>
      )}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: Spacing.half },
  joinBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    minWidth: 72,
    alignItems: 'center',
  },
});
