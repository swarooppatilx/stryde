import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTransactor } from '@/hooks/useTransactor';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useCommunityStore } from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import { haptics } from '@/utils/haptics';

const SPORT_ICON_NAME = (sport: ActivityType | 'multi'): keyof typeof Ionicons.glyphMap => {
  if (sport === 'multi') return 'fitness';
  return (SPORT_ICONS[sport] ?? 'walk') as keyof typeof Ionicons.glyphMap;
};

const SPORT_LABEL: Record<string, string> = {
  run: 'Running',
  ride: 'Cycling',
  walk: 'Walking',
  hike: 'Hiking',
  swim: 'Swimming',
  yoga: 'Yoga',
  workout: 'Workout',
  hiit: 'HIIT',
  dance: 'Dance',
  climb: 'Climbing',
  skate: 'Skating',
  row: 'Rowing',
  multi: 'Multi-Sport',
};

const formatMemberCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

const formatDistance = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(0)}km`;
  return `${meters}m`;
};

const formatDateRange = (start: Date, end: Date) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const getDaysRemaining = (end: Date) => {
  const now = new Date();
  const endDate = new Date(end);
  const diff = endDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Ended';
  if (days === 0) return 'Ends today';
  return `${days} days left`;
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const getEventById = useCommunityStore((s) => s.getEventById);
  const applyEventJoin = useCommunityStore((s) => s.applyEventJoin);
  const joinedEvents = useCommunityStore((s) => s.joinedEvents);
  const isEventHost = useCommunityStore((s) => s.isEventHost);

  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();
  const [joining, setJoining] = useState(false);

  const event = getEventById(id ?? '');
  const isJoined = event ? joinedEvents.includes(event.id) : false;
  const isHost = isEventHost(id ?? '', address ?? undefined);

  if (!event) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="sectionTitle">Event</ThemedText>
            <View style={{ width: 24 }} />
          </ThemedView>
          <ThemedView style={styles.empty}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Event not found
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const handleJoin = async () => {
    if (!wallet || !event || joining) return;
    haptics.impactMedium();
    setJoining(true);
    try {
      await transact(
        () =>
          isJoined
            ? services.event.leaveEvent(wallet, BigInt(event.id))
            : services.event.joinEvent(wallet, BigInt(event.id)),
        {
          pending: isJoined ? 'Leaving event...' : 'Joining event...',
          success: isJoined ? 'Left event' : 'Joined event',
        },
        {
          apply: () => applyEventJoin(event.id, !isJoined),
          revert: () => applyEventJoin(event.id, isJoined),
        }
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText
            type="sectionTitle"
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center' }}
          >
            Event
          </ThemedText>
          <View style={{ width: 24 }} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Event Icon + Title */}
          <ThemedView style={styles.hero}>
            <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
              <Ionicons
                name={SPORT_ICON_NAME(event.sportType)}
                size={36}
                color={theme.brand.primary}
              />
            </ThemedView>
            <ThemedText type="title">{event.title}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {SPORT_LABEL[event.sportType] || event.sportType}
            </ThemedText>
          </ThemedView>

          {/* Stats Row */}
          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatDateRange(event.startDate, event.endDate)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Duration
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {event.distanceGoal > 0 ? formatDistance(event.distanceGoal) : '—'}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Goal
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatMemberCount(event.participantCount)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Participants
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.brand.primary }]}>
                {getDaysRemaining(event.endDate)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Status
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Description */}
          <ThemedView style={styles.section}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              About this event
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.text }}>
              {event.description}
            </ThemedText>
          </ThemedView>

          {/* Join Button */}
          <TouchableOpacity
            style={[
              styles.joinBtn,
              {
                backgroundColor: isHost || isJoined ? 'transparent' : theme.brand.primary,
                borderColor: isHost ? theme.border : isJoined ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={handleJoin}
            activeOpacity={0.7}
            disabled={joining || isHost || !wallet || !address}
            accessibilityRole="button"
            accessibilityLabel={
              isHost
                ? `You host ${event.title}`
                : isJoined
                  ? `Leave ${event.title}`
                  : `Join ${event.title}`
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
                style={{
                  color: isHost
                    ? theme.textSecondary
                    : isJoined
                      ? theme.textSecondary
                      : Brand.white,
                }}
              >
                {isHost ? 'Hosting' : isJoined ? 'Joined — Tap to Leave' : 'Join Challenge'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
    fontWeight: '700',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  section: {
    gap: Spacing.two,
  },
  joinBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    marginTop: Spacing.two,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
