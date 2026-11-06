import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { eventKey, setEventMember } from '@/backends/membership';
import { AppButton } from '@/components/button';
import { CommunityCard } from '@/components/community-card';
import { DetailFallback } from '@/components/list-message';
import { ShareButton } from '@/components/share-button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { stockImageFor } from '@/constants/stockImages';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useChainAction } from '@/hooks/useChainAction';
import { useEventParticipants } from '@/hooks/useEventParticipants';
import { useGoBack } from '@/hooks/useGoBack';
import { useDelivery } from '@/hooks/useOutbox';
import { useUserResolver } from '@/hooks/useSocialUser';
import { getPlatform } from '@/platform';
import { useCommunityStore } from '@/stores/communityStore';
import { Alert } from '@/utils/alert';
import { calendarLink } from '@/utils/calendarLink';
import { confirmLeave } from '@/utils/confirmLeave';
import { formatDateRange } from '@/utils/dates';
import { buildDetailDeepLink } from '@/utils/deepLink';
import { eventJoinState, eventStatus } from '@/utils/eventStatus';
import { formatDistance, formatMemberCount, getDisplayName, SPORT_LABEL } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { directionsUrl, formatMeetingPoint, usefulPlaceName } from '@/utils/meetingPoint';
import { otherEvents } from '@/utils/otherEvents';
import { Toast } from '@/utils/toast';

/** How many sign-ups to show before "and N more". */
const SHOWN_PARTICIPANTS = 8;

function joinAccessibilityLabel(title: string, isHost: boolean, isJoined: boolean): string {
  if (isHost) return `You host ${title}`;
  return isJoined ? `Leave ${title}` : `Join ${title}`;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();

  const joinedEvents = useCommunityStore((s) => s.joinedEvents);
  const isEventHost = useCommunityStore((s) => s.isEventHost);

  const { address, run } = useChainAction();
  const upsertEvent = useCommunityStore((s) => s.upsertEvent);
  const removeEvent = useCommunityStore((s) => s.removeEvent);
  const resolveUser = useUserResolver();
  const { participants } = useEventParticipants(id);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const joining = useDelivery(eventKey(id ?? '')) !== undefined;

  const event = useCommunityStore((s) => s.events.find((e) => e.id === id));
  const router = useRouter();
  const allEvents = useCommunityStore((s) => s.events);
  const more = otherEvents(allEvents, id ?? '', new Date(), 3);
  const fetchEvents = useCommunityStore((s) => s.fetchEvents);
  const eventsLoading = useCommunityStore((s) => s.eventsLoading);
  const eventsError = useCommunityStore((s) => s.eventsError);
  // Opened straight from a link, before the Groups tab loaded the list.
  const missing = !event;
  useEffect(() => {
    if (missing) void fetchEvents();
  }, [missing, fetchEvents]);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };
  const meetingPoint = event?.meetingPoint;
  useEffect(() => {
    if (!meetingPoint) return;
    let cancelled = false;
    // Only a real place name; the coordinates are shown anyway.
    void getPlatform()
      .geocoder.placeName(meetingPoint.latitude, meetingPoint.longitude)
      .then((name) => !cancelled && setPlaceName(usefulPlaceName(name)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [meetingPoint]);
  const isJoined = event ? joinedEvents.includes(event.id) : false;
  const isHost = isEventHost(id ?? '', address ?? undefined);

  if (!event) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.header}>
            <Tappable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Tappable>
            <ThemedText type="sectionTitle">Event</ThemedText>
            <View style={{ width: 24 }} />
          </ThemedView>
          <DetailFallback
            what="event"
            loading={eventsLoading}
            error={eventsError}
            onRetry={() => void fetchEvents()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const status = eventStatus(event.startDate, event.endDate);
  const joinState = eventJoinState({ isHost, isJoined, ended: status.phase === 'ended' });
  const muted = isHost || isJoined || joinState.disabled;

  const handleJoin = async () => {
    if (!event) return;
    haptics.impactMedium();
    if (isJoined) {
      confirmLeave('event', event.title, () => void setEventMember(event.id, false));
      return;
    }
    await setEventMember(event.id, true);
  };

  const cancelEvent = () =>
    Alert.alert(
      `Cancel ${event.title}?`,
      'It disappears for everyone who signed up. This cannot be undone.',
      [
        { text: 'Keep event', style: 'cancel' },
        {
          text: 'Cancel event',
          style: 'destructive',
          onPress: async () => {
            const result = await run(
              (wallet) => services.event.cancelEvent(wallet, BigInt(event.id)),
              { pending: 'Cancelling event...', success: 'Event cancelled' },
              { apply: () => removeEvent(event.id), revert: () => upsertEvent(event) }
            );
            if (result?.confirmed) goBack();
          },
        },
      ]
    );

  const nameOf = (who: string) => {
    const user = resolveUser(who);
    return user ? getDisplayName(user) : `${who.slice(0, 6)}…${who.slice(-4)}`;
  };
  const me = address?.toLowerCase();

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText
            type="sectionTitle"
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center' }}
          >
            Event
          </ThemedText>
          <ShareButton
            label="Share this event"
            message={`${event.title} on Stryde\n${buildDetailDeepLink('events', event.id)}`}
          />
        </ThemedView>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
              colors={[theme.brand.primary]}
            />
          }
        >
          <ThemedView style={styles.hero}>
            <Image
              source={stockImageFor('event', event.id)}
              style={styles.cover}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <ThemedText type="title">{event.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {SPORT_LABEL[event.sportType] || event.sportType}
            </ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatDateRange(event.startDate, event.endDate, { withYear: true })}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Dates
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {event.distanceGoal > 0 ? formatDistance(event.distanceGoal, unitSystem) : '—'}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Goal
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatMemberCount(event.participantCount)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Participants
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.brand.primary }]}>
                {status.label}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Status
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              About this event
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.text }}>
              {event.description}
            </ThemedText>
          </ThemedView>

          {meetingPoint && (
            <ThemedView style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Meeting point
              </ThemedText>
              <View style={[styles.placeRow, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="location" size={20} color={theme.brand.primary} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {placeName ?? formatMeetingPoint(meetingPoint)}
                  </ThemedText>
                  {placeName ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatMeetingPoint(meetingPoint)}
                    </ThemedText>
                  ) : null}
                </View>
                <Tappable
                  onPress={() =>
                    void Linking.openURL(directionsUrl(meetingPoint)).catch(() =>
                      Toast.fail("Couldn't open maps", 1.5)
                    )
                  }
                  hitSlop={8}
                  accessibilityRole="link"
                  accessibilityLabel="Directions to the meeting point"
                >
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    Directions
                  </ThemedText>
                </Tappable>
              </View>
            </ThemedView>
          )}

          {status.phase !== 'ended' && (
            <Tappable
              onPress={() =>
                void Linking.openURL(
                  calendarLink({
                    title: event.title,
                    description: event.description,
                    start: event.startDate,
                    end: event.endDate,
                  })
                ).catch(() => Toast.fail('Could not open the calendar', 1.5))
              }
              accessibilityRole="link"
              accessibilityLabel={`Add ${event.title} to your calendar`}
              hitSlop={8}
              style={styles.calendarLink}
            >
              <Ionicons name="calendar-outline" size={16} color={theme.accentText} />
              <ThemedText type="small" style={{ color: theme.accentText }}>
                Add to calendar
              </ThemedText>
            </Tappable>
          )}

          <Tappable
            style={[
              styles.joinBtn,
              {
                backgroundColor: muted ? 'transparent' : theme.brand.primary,
                borderColor: muted ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={handleJoin}
            activeOpacity={0.7}
            disabled={joining || joinState.disabled}
            accessibilityRole="button"
            accessibilityLabel={
              joinState.disabled && !isHost
                ? `${joinState.label}: ${event.title}`
                : joinAccessibilityLabel(event.title, isHost, isJoined)
            }
          >
            {joining ? (
              <ActivityIndicator
                size="small"
                color={isJoined ? theme.textSecondary : Brand.white}
              />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: muted ? theme.textSecondary : Brand.white }}
              >
                {joinState.label}
              </ThemedText>
            )}
          </Tappable>

          {participants && participants.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Who's going
              </ThemedText>
              {participants.slice(0, SHOWN_PARTICIPANTS).map((who) => (
                <Tappable
                  key={who}
                  onPress={() => router.push(`/athletes/${who}`)}
                  style={styles.personRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${nameOf(who)}'s profile`}
                >
                  <UserAvatar uri={resolveUser(who)?.avatar} name={nameOf(who)} size="sm" />
                  <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                    {nameOf(who)}
                    {who === me ? ' (you)' : ''}
                  </ThemedText>
                  {who === event.host?.toLowerCase() ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      Host
                    </ThemedText>
                  ) : null}
                </Tappable>
              ))}
              {participants.length > SHOWN_PARTICIPANTS ? (
                <ThemedText type="small" themeColor="textSecondary">
                  and {participants.length - SHOWN_PARTICIPANTS} more
                </ThemedText>
              ) : null}
            </ThemedView>
          )}

          {isHost && status.phase !== 'ended' && (
            <AppButton variant="danger" onPress={cancelEvent}>
              Cancel event
            </AppButton>
          )}

          {more.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                More events
              </ThemedText>
              {more.map((other) => (
                <CommunityCard
                  key={other.id}
                  icon="calendar-outline"
                  image={stockImageFor('event', other.id)}
                  title={other.title}
                  lines={[
                    eventStatus(other.startDate, other.endDate).label,
                    formatDateRange(other.startDate, other.endDate),
                  ]}
                  onPress={() => router.push(`/events/${other.id}`)}
                />
              ))}
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  calendarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one + 2,
  },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: BorderRadius.lg },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.three,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: {
    ...textStyle(TypeScale.bodyBold),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  section: {
    gap: Spacing.two,
  },
  flex: { flex: 1 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  joinBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    marginTop: Spacing.two,
  },
});
