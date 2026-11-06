import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ListMessage } from '@/components/list-message';
import { PersonRow } from '@/components/search-rows';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useClubMembers } from '@/hooks/useClubMembers';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useSocialStore } from '@/stores/socialStore';
import { sameAddress } from '@/utils/address';
import { rankClubMembers } from '@/utils/clubRanking';
import { followListUsers } from '@/utils/followListUsers';
import { formatDistance, getDisplayName } from '@/utils/format';
import { withoutHidden } from '@/utils/withoutHidden';

const PREVIEW = 5;
const RANK_DAYS = 30;
const RANK_SHOWN = 5;

/** The people in a club, owner first; a few at a time, all on request. Not shown where no member list exists. */
export function ClubMembers({ clubId, owner }: { clubId: string; owner: string }) {
  const router = useRouter();
  const theme = useTheme();
  const me = useCurrentUserId();
  const resolve = useUserResolver();
  const hidden = useHiddenAuthors();
  const { state, reload } = useClubMembers(clubId, owner);
  const [showAll, setShowAll] = useState(false);

  const users =
    state.status === 'ready'
      ? withoutHidden(followListUsers(state.members, resolve), (u) => u.id, hidden)
      : [];

  const activities = useSocialStore((s) => s.activities);
  const unitSystem = useUnitSystem();
  const ranking =
    state.status === 'ready'
      ? rankClubMembers(state.members, Object.values(activities), new Date(), RANK_DAYS)
          .filter((row) => !hidden.has(row.userId))
          .slice(0, RANK_SHOWN)
      : [];

  if (state.status === 'unavailable') return null;
  if (state.status === 'loading') {
    return <ActivityIndicator style={styles.loading} color={theme.brand.primary} />;
  }
  if (state.status === 'error') {
    return (
      <ListMessage
        icon="cloud-offline-outline"
        text="Couldn't load the members."
        action={{ label: 'Try again', onPress: () => void reload() }}
      />
    );
  }
  if (users.length === 0) return null;

  const shown = showAll ? users : users.slice(0, PREVIEW);
  return (
    <View style={styles.section}>
      {ranking.length > 0 && (
        <View style={styles.ranking}>
          <ThemedText
            type="eyebrow"
            style={{ color: theme.textSecondary }}
            accessibilityRole="header"
          >
            Last 30 days
          </ThemedText>
          {ranking.map((row, index) => {
            const user = resolve(row.userId);
            const name = user ? getDisplayName(user) : `${row.userId.slice(0, 6)}…`;
            return (
              <View
                key={row.userId}
                style={styles.rankRow}
                accessible
                accessibilityLabel={`${index + 1}. ${name}, ${formatDistance(row.distance, unitSystem)}`}
              >
                <ThemedText type="smallBold" style={styles.rank}>
                  {index + 1}
                </ThemedText>
                <UserAvatar uri={user?.avatar} name={name} size={32} />
                <ThemedText type="small" numberOfLines={1} style={styles.rankName}>
                  {name}
                </ThemedText>
                <ThemedText type="smallBold">{formatDistance(row.distance, unitSystem)}</ThemedText>
              </View>
            );
          })}
        </View>
      )}
      <ThemedText type="eyebrow" style={{ color: theme.textSecondary }} accessibilityRole="header">
        Members
      </ThemedText>
      {shown.map((user) => (
        <PersonRow
          key={user.id}
          user={user}
          tag={sameAddress(user.id, owner) ? 'Owner' : undefined}
          showFollow={user.id.toLowerCase() !== me.toLowerCase()}
          onPress={() => router.push(`/athletes/${user.id}`)}
        />
      ))}
      {users.length > PREVIEW && (
        <Tappable
          onPress={() => setShowAll((all) => !all)}
          accessibilityRole="button"
          style={styles.more}
        >
          <ThemedText type="smallBold" style={{ color: theme.accentText }}>
            {showAll ? 'Show fewer' : `View all ${users.length}`}
          </ThemedText>
        </Tappable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.one },
  ranking: { gap: Spacing.one, paddingBottom: Spacing.three },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  rank: { width: 20, textAlign: 'center' },
  rankName: { flex: 1 },
  loading: { paddingVertical: Spacing.three },
  more: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
