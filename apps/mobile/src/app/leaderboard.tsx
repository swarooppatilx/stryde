import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChipRow } from '@/components/filter-chips';
import { ListLoading, ListMessage } from '@/components/list-message';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSocialStore } from '@/stores/socialStore';
import { sameAddress } from '@/utils/address';
import { rankByDistance } from '@/utils/clubRanking';
import { formatArea, formatDistance } from '@/utils/format';
import {
  BOARD_PERIODS,
  type BoardPeriod,
  boardPeriodStart,
  countableActivities,
  leaderboardView,
  periodBoardError,
  rankSummary,
} from '@/utils/leaderboardView';
import { logger } from '@/utils/logger';
import { countOf } from '@/utils/plural';
import type { SocialActivity, SocialUser } from '@/utils/socialSelectors';
import type { WeekStartDay } from '@/utils/trainingLog';

interface LeaderboardRow {
  wallet: string;
  username: string;
  distance: number;
  territoryArea: number;
  achievementCount: number;
  /** Passed World ID verification, as the chain records it. */
  isVerified?: boolean;
  /** Activities in the week or month; absent on the season board, which counts contributions. */
  activityCount?: number;
}

interface PeriodBoardInput {
  period: BoardPeriod;
  feedStatus: 'idle' | 'loading' | 'ready' | 'error';
  activities: Record<string, SocialActivity>;
  viewerId: string;
  following: ReadonlySet<string>;
  weekStartsOn: WeekStartDay;
  hidden: ReadonlySet<string>;
  resolveUser: (id: string) => SocialUser | undefined;
}

/** The week or month board counted from the feed; null for the season board or while the feed has nothing yet. */
function periodBoardRows({
  period,
  feedStatus,
  activities,
  viewerId,
  following,
  weekStartsOn,
  hidden,
  resolveUser,
}: PeriodBoardInput): LeaderboardRow[] | null {
  if (period === 'season') return null;
  if (feedStatus === 'idle' || (feedStatus === 'loading' && Object.keys(activities).length === 0))
    return null;
  // Only what the athlete could see in the feed counts: not an Only Me run, not a simulated
  // location, not someone they blocked or muted.
  const counted = countableActivities(Object.values(activities), viewerId, following);
  return rankByDistance(
    counted,
    boardPeriodStart(period, new Date(), weekStartsOn),
    (userId) => !hidden.has(userId)
  ).map((ranked) => ({
    wallet: ranked.userId,
    username: resolveUser(ranked.userId)?.username || 'Athlete',
    distance: ranked.distance,
    territoryArea: 0,
    achievementCount: 0,
    activityCount: ranked.count,
  }));
}

const ENS_CONCURRENCY = 5;

async function resolveEnsNamesBatch(wallets: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(wallets.map((w) => w.toLowerCase()))];
  const resolved = new Map<string, string>();
  for (let i = 0; i < unique.length; i += ENS_CONCURRENCY) {
    const chunk = unique.slice(i, i + ENS_CONCURRENCY);
    await Promise.all(
      chunk.map(async (addr) => {
        try {
          const name = await services.ens.resolveEnsName(addr as `0x${string}`);
          if (name) resolved.set(addr, name);
        } catch (error) {
          logger.warn('[Leaderboard] ENS resolution failed', addr, error);
        }
      })
    );
  }
  return resolved;
}

const LeaderboardRowItem = memo(function LeaderboardRowItem({
  row,
  rank,
  isMe,
  theme,
  ensName,
  onPress,
}: {
  row: LeaderboardRow;
  rank: number;
  isMe: boolean;
  theme: ReturnType<typeof useTheme>;
  ensName: string | null;
  onPress: () => void;
}) {
  const unitSystem = useUnitSystem();
  const name = isMe ? 'You' : ensName || row.username;
  const avatar = useUserResolver()(row.wallet)?.avatar;
  return (
    <Tappable
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}, ${name}${row.isVerified ? ', verified' : ''}, ${formatDistance(row.distance, unitSystem)}. Open profile`}
      style={[
        styles.row,
        { backgroundColor: isMe ? theme.brand.primaryTint : theme.backgroundElement },
      ]}
    >
      <ThemedText type="smallBold" style={styles.rank}>
        {rank}
      </ThemedText>
      <UserAvatar uri={avatar} name={row.username} size="sm" />
      <ThemedView style={styles.rowInfo}>
        <ThemedView style={styles.nameRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.nameText}>
            {name}
          </ThemedText>
          {row.isVerified ? (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={theme.brand.verified}
              accessibilityLabel="Verified account"
            />
          ) : null}
        </ThemedView>
        {row.activityCount !== undefined && (
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {countOf(row.activityCount, 'activity', 'activities')}
          </ThemedText>
        )}
        {(row.territoryArea > 0 || row.achievementCount > 0) && (
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {row.territoryArea > 0 ? `${formatArea(row.territoryArea, unitSystem)} territory` : ''}
            {row.territoryArea > 0 && row.achievementCount > 0 ? ' · ' : ''}
            {row.achievementCount > 0
              ? countOf(row.achievementCount, 'achievement', 'achievements')
              : ''}
          </ThemedText>
        )}
      </ThemedView>
      <ThemedText type="smallBold">{formatDistance(row.distance, unitSystem)}</ThemedText>
    </Tappable>
  );
});

function emptyBoardText(period: BoardPeriod, seasonActive: boolean): string {
  if (period !== 'season') return EMPTY_PERIOD[period];
  return seasonActive
    ? 'No contributions yet this season. Record an activity to appear here.'
    : 'No active season yet. Record an activity to start one.';
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [seasonActive, setSeasonActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ensNames, setEnsNames] = useState<Map<string, string>>(() => new Map());
  const currentUserId = useCurrentUserId();
  const resolveUser = useUserResolver();
  const activities = useSocialStore((s) => s.activities);
  const feedStatus = useSocialStore((s) => s.feedStatus);

  const load = async () => {
    try {
      const season = await services.season.getCurrentSeason();
      setError(null);
      setSeasonActive(season.isActive);
      if (!season.isActive) {
        setRows([]);
        return;
      }

      const users = await services.profile.getRegisteredUsers();
      const usernameByWallet = new Map(users.map((u) => [u.wallet.toLowerCase(), u.username]));
      const entries = await services.season.getWeightedLeaderboard(
        season.id,
        users.map((u) => u.wallet as `0x${string}`),
        usernameByWallet
      );

      const leaderboardRows = entries.map((e) => ({
        wallet: e.wallet,
        username: usernameByWallet.get(e.wallet.toLowerCase()) ?? (e.username || 'Unknown'),
        distance: e.distance,
        territoryArea: e.territoryArea,
        achievementCount: e.achievementCount,
        isVerified: e.isVerified,
      }));
      setRows(leaderboardRows);
      // Names already found stay while the new batch resolves, so rows don't flicker back to usernames.
      resolveEnsNamesBatch(leaderboardRows.map((r) => r.wallet))
        .then((names) => setEnsNames((previous) => new Map([...previous, ...names])))
        .catch((e) => logger.warn('[Leaderboard] ENS batch failed', e));
    } catch (e) {
      logger.warn('[Leaderboard] Failed to load:', e);
      setError('Failed to load the leaderboard. Check your connection and try again.');
      // Keep whatever was already loaded; the screen shows a banner instead of a blank board.
      setRows((previous) => previous ?? []);
    }
  };

  // The week and month boards are counted on the phone from the feed's activities, so they work
  // offline and in every profile; only the season board asks the chain.
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  useFocusEffect(() => {
    if (period === 'season') void load();
    else fetchActivities();
  });

  const onRefresh = () => {
    setRefreshing(true);
    (period === 'season' ? load() : fetchActivities()).finally(() => setRefreshing(false));
  };

  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const hidden = useHiddenAuthors();
  const following = useSocialStore((s) => s.following);
  const periodRows: LeaderboardRow[] | null = periodBoardRows({
    period,
    feedStatus,
    activities,
    viewerId: currentUserId,
    following,
    weekStartsOn,
    hidden,
    resolveUser,
  });

  const shownRows = period === 'season' ? rows : periodRows;
  const periodError = periodBoardError(
    feedStatus === 'error',
    Object.keys(activities).length,
    periodRows?.length ?? 0
  );
  const view = leaderboardView({
    rows: shownRows,
    error: period === 'season' ? error : periodError,
  });
  const myRank = shownRows ? rankSummary(shownRows, currentUserId) : null;

  const renderBody = () => {
    if (view.kind === 'loading') {
      return <ListLoading fill />;
    }
    if (view.kind === 'error') {
      return (
        <ListMessage
          fill
          icon="alert-circle-outline"
          text={view.message}
          action={{ label: 'Retry', onPress: onRefresh }}
        />
      );
    }
    if (view.kind === 'empty') {
      return <ListMessage fill icon="trophy-outline" text={emptyBoardText(period, seasonActive)} />;
    }
    return (
      <FlatList
        data={shownRows}
        ListHeaderComponent={
          <>
            {myRank ? (
              <ThemedText type="smallBold" style={styles.banner}>
                {myRank}
              </ThemedText>
            ) : null}
            <ThemedText type="caption" themeColor="textSecondary" style={styles.banner}>
              {RANKING_NOTE[period]}
            </ThemedText>
            {view.kind === 'list' && view.banner ? (
              <ThemedText type="caption" themeColor="dangerText" style={styles.banner}>
                {view.banner}
              </ThemedText>
            ) : null}
          </>
        }
        keyExtractor={(row) => row.wallet}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand.primary}
          />
        }
        renderItem={({ item: row, index }) => {
          const isMe = sameAddress(row.wallet, currentUserId);
          return (
            <LeaderboardRowItem
              row={row}
              rank={index + 1}
              isMe={isMe}
              theme={theme}
              ensName={ensNames.get(row.wallet.toLowerCase()) ?? null}
              onPress={() => router.push(isMe ? '/(tabs)/profile' : `/athletes/${row.wallet}`)}
            />
          );
        }}
      />
    );
  };

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
          <ThemedText type="sectionTitle">Leaderboard</ThemedText>
          <View style={{ width: 24 }} />
        </ThemedView>
        <View style={styles.periods}>
          <ChipRow options={BOARD_PERIODS} value={period} onChange={setPeriod} />
        </View>

        {renderBody()}
      </SafeAreaView>
    </ThemedView>
  );
}

/** The season order is not by distance alone, so say what each board counts. */
const RANKING_NOTE: Record<BoardPeriod, string> = {
  week: 'Distance since Sunday, from the activities in your feed.',
  month: 'Distance since the 1st, from the activities in your feed.',
  season:
    'Ranked by distance, territory you hold and badges earned. The distance shown is this season’s.',
};

const EMPTY_PERIOD: Record<'week' | 'month', string> = {
  week: 'Nobody has been out yet this week. Record an activity to top the board.',
  month: 'Nobody has been out yet this month. Record an activity to top the board.',
};

const styles = StyleSheet.create({
  banner: { paddingBottom: Spacing.two },
  periods: { paddingHorizontal: Spacing.four },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  nameText: { flexShrink: 1 },
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
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  rank: {
    width: 24,
    textAlign: 'center',
  },
  rowInfo: {
    flex: 1,
  },
});
