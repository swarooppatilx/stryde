import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const getClubById = useCommunityStore((s) => s.getClubById);
  const toggleJoinClub = useCommunityStore((s) => s.toggleJoinClub);
  const joinedClubs = useCommunityStore((s) => s.joinedClubs);

  const club = getClubById(id ?? '');
  const isJoined = club ? joinedClubs.includes(club.id) : false;

  if (!club) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="sectionTitle">Club</ThemedText>
            <View style={{ width: 24 }} />
          </ThemedView>
          <ThemedView style={styles.empty}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Club not found
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const handleJoin = () => {
    haptics.impactMedium();
    toggleJoinClub(club.id);
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
            {club.name}
          </ThemedText>
          <View style={{ width: 24 }} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Club Icon + Name */}
          <ThemedView style={styles.hero}>
            <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
              <Ionicons
                name={SPORT_ICON_NAME(club.sportType)}
                size={36}
                color={theme.brand.primary}
              />
            </ThemedView>
            <ThemedText type="title">{club.name}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {club.location}
            </ThemedText>
          </ThemedView>

          {/* Stats Row */}
          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatMemberCount(club.memberCount)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Members
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {SPORT_LABEL[club.sportType] || club.sportType}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Sport
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Description */}
          <ThemedView style={styles.section}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              About
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.text }}>
              {club.description}
            </ThemedText>
          </ThemedView>

          {/* Join Button */}
          <TouchableOpacity
            style={[
              styles.joinBtn,
              {
                backgroundColor: isJoined ? 'transparent' : theme.brand.primary,
                borderColor: isJoined ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={handleJoin}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isJoined ? `Leave ${club.name}` : `Join ${club.name}`}
          >
            <ThemedText
              type="smallBold"
              style={{ color: isJoined ? theme.textSecondary : Brand.white }}
            >
              {isJoined ? 'Joined — Tap to Leave' : 'Join Club'}
            </ThemedText>
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
    fontSize: 18,
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
