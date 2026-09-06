import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance } from '@/utils/format';

interface LeaderboardRow {
  wallet: string;
  username: string;
  distance: number;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [seasonActive, setSeasonActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = getCurrentUserId();

  const load = useCallback(async () => {
    try {
      const season = await services.season.getCurrentSeason();
      setSeasonActive(season.isActive);
      if (!season.isActive) {
        setRows([]);
        return;
      }

      const users = await services.profile.getRegisteredUsers();
      const entries = await services.season.getLeaderboard(
        season.id,
        users.map((u) => u.wallet as `0x${string}`)
      );

      const usernameByWallet = new Map(users.map((u) => [u.wallet.toLowerCase(), u.username]));
      setRows(
        entries.map((e) => ({
          wallet: e.participant,
          username: usernameByWallet.get(e.participant.toLowerCase()) ?? 'Unknown',
          distance: Number(e.contribution),
        }))
      );
    } catch {
      setRows([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="sectionTitle">Leaderboard</ThemedText>
          <View style={{ width: 24 }} />
        </ThemedView>

        {rows === null ? (
          <ThemedView style={styles.empty}>
            <ActivityIndicator size="large" />
          </ThemedView>
        ) : rows.length === 0 ? (
          <ThemedView style={styles.empty}>
            <Ionicons name="trophy-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
              {seasonActive
                ? 'No contributions yet this season. Record an activity to appear here.'
                : 'No active season yet. Record an activity to start one.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.brand.primary}
              />
            }
          >
            {rows.map((row, index) => {
              const isMe = row.wallet.toLowerCase() === currentUserId.toLowerCase();
              return (
                <ThemedView
                  key={row.wallet}
                  style={[
                    styles.row,
                    { backgroundColor: isMe ? theme.brand.primaryTint : theme.backgroundElement },
                  ]}
                >
                  <ThemedText type="smallBold" style={styles.rank}>
                    {index + 1}
                  </ThemedText>
                  <ThemedView style={styles.rowInfo}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {isMe ? 'You' : row.username}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="smallBold">{formatDistance(row.distance)}</ThemedText>
                </ThemedView>
              );
            })}
          </ScrollView>
        )}
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
