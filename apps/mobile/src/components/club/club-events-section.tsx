import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCommunityStore } from '@/stores/communityStore';

/** The events this club hosts, soonest first; nothing when it has none. */
export function ClubEventsSection({ eventIds }: { eventIds: readonly string[] }) {
  const theme = useTheme();
  const router = useRouter();
  const events = useCommunityStore((s) => s.events)
    .filter((e) => eventIds.includes(e.id))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  if (events.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Club events
      </ThemedText>
      {events.map((event) => (
        <Tappable
          key={event.id}
          onPress={() => router.push(`/events/${event.id}`)}
          style={[styles.row, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${new Date(event.startDate).toDateString()}`}
        >
          <Ionicons name="calendar-outline" size={20} color={theme.brand.primary} />
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {event.title}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {new Date(event.startDate).toDateString()} · {event.participantCount} going
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Tappable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  text: { flex: 1 },
});
