import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { PersonRow } from '@/components/search-rows';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FeedExtraCard as Card } from '@/utils/feedCards';

interface Props {
  card: Card;
  onDismiss: () => void;
}

/** A suggestion, club or challenge card between feed items; the close button hides it for good. */
export function FeedExtraCard({ card, onDismiss }: Props) {
  const router = useRouter();
  const theme = useTheme();

  let title = '';
  let body: React.ReactNode = null;
  if (card.kind === 'suggested') {
    title = 'Athletes to follow';
    body = card.people.map((user) => (
      <PersonRow
        key={user.id}
        user={user}
        showFollow
        onPress={() => router.push(`/athletes/${user.id}`)}
      />
    ));
  } else if (card.kind === 'club') {
    title = `From ${card.clubName}`;
    body = (
      <Tappable
        onPress={() => router.push(`/clubs/${card.clubId}`)}
        accessibilityRole="link"
        accessibilityLabel={`Open ${card.clubName}`}
      >
        <ThemedText type="small" numberOfLines={3}>
          {card.text}
        </ThemedText>
      </Tappable>
    );
  } else {
    const percent = card.progress === null ? null : Math.round(card.progress * 100);
    title = card.joined ? 'Your challenge' : 'Challenge to join';
    body = (
      <Tappable
        onPress={() => router.push(`/events/${card.eventId}`)}
        accessibilityRole="link"
        accessibilityLabel={`Open ${card.title}`}
      >
        <ThemedText type="small">{card.title}</ThemedText>
        {percent !== null && (
          <ThemedText type="caption" themeColor="textSecondary">
            {`${percent}% of the goal`}
          </ThemedText>
        )}
      </Tappable>
    );
  }

  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.title}>
          {title}
        </ThemedText>
        <Tappable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Hide ${title}`}
        >
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Tappable>
      </View>
      {body}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
});
