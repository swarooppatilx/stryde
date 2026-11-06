import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { sendClubChange } from '@/backends/clubIntents';
import { clubKey, setClubMember } from '@/backends/membership';
import { AppButton } from '@/components/button';
import { ClubEventsSection } from '@/components/club/club-events-section';
import { ClubFeed } from '@/components/club/club-feed';
import { ClubLeaderboard } from '@/components/club/club-leaderboard';
import { ClubMembersPanel } from '@/components/club/club-members-panel';
import { ClubMembers } from '@/components/club-members';
import { DetailFallback } from '@/components/list-message';
import { ShareButton } from '@/components/share-button';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnderlineTabs } from '@/components/underline-tabs';
import { SPORT_ICONS } from '@/constants/activity';
import { getCurrentUserId } from '@/constants/config';
import { stockImageFor } from '@/constants/stockImages';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useBalances } from '@/hooks/useBalances';
import { useChainAction } from '@/hooks/useChainAction';
import { useClubMembers } from '@/hooks/useClubMembers';
import { useClubTreasury } from '@/hooks/useClubTreasury';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGoBack } from '@/hooks/useGoBack';
import { useDelivery } from '@/hooks/useOutbox';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useClubStore } from '@/stores/clubStore';
import { useCommunityStore } from '@/stores/communityStore';
import { useSocialStore } from '@/stores/socialStore';
import type { ActivityType } from '@/types';
import { sameAddress, viewerAddress } from '@/utils/address';
import { Alert } from '@/utils/alert';
import { confirmLeave } from '@/utils/confirmLeave';
import { buildDetailDeepLink } from '@/utils/deepLink';
import { parseEthAmount } from '@/utils/eth';
import { formatMemberCount, getDisplayName, SPORT_LABEL } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { ipfsToHttpUrl } from '@/utils/ipfsUrl';
import { treasuryAmountError } from '@/utils/stakeAlerts';

const CLUB_TABS = ['Overview', 'Feed', 'Leaderboard', 'Members'] as const;
type ClubTab = (typeof CLUB_TABS)[number];
const EMPTY_VIEW = { state: null, feed: [], loading: false, error: null };
const DEFAULT_SETTINGS = {
  name: '',
  location: '',
  description: '',
  photo: '',
  cover: '',
  inviteOnly: false,
  adminsOnlyPost: false,
  showLeaderboard: true,
};

/** "Kavya has joined", "Kavya and Nithya have joined", "3 athletes you follow have joined". */
export function followedJoinedText(names: readonly string[]): string {
  if (names.length === 1) return `${names[0]} has joined`;
  if (names.length === 2) return `${names[0]} and ${names[1]} have joined`;
  return `${names.length} athletes you follow have joined`;
}

/** How long typing must pause before an amount is judged, so "0." on the way to "0.05" is not an error. */
const AMOUNT_PAUSE_MS = 500;

/** One icon-and-text fact in the club header, such as "Running", "2,456 Members" and "Public". */
function MetaItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.metaItem}>
      <Ionicons name={icon} size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </ThemedView>
  );
}

const SPORT_ICON_NAME = (sport: ActivityType | 'multi'): keyof typeof Ionicons.glyphMap => {
  if (sport === 'multi') return 'fitness';
  return (SPORT_ICONS[sport] ?? 'walk') as keyof typeof Ionicons.glyphMap;
};

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const router = useRouter();
  const theme = useTheme();

  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const clubsLoading = useCommunityStore((s) => s.clubsLoading);
  const clubsError = useCommunityStore((s) => s.clubsError);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);

  const { wallet, address, run } = useChainAction();
  const isPending = useDelivery(clubKey(id ?? '')) !== undefined;

  // Group treasury: a club-wide wallet. Anyone can deposit; only the owner can withdraw.
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isTreasuryPending, setIsTreasuryPending] = useState(false);

  // Selected, not read through a getter: the screen must update when the list loads or refreshes.
  const club = useCommunityStore((s) => s.clubs.find((c) => c.id === id));
  const isJoined = club ? joinedClubIds.includes(club.id) : false;
  const viewer = viewerAddress(useCurrentUserId(), address);
  const isOwner = !!(club && sameAddress(club.owner, viewer ?? undefined));
  const quiet = isOwner || isJoined;

  // Feed, settings, admins and join requests live in the club API; membership stays on chain.
  const [tab, setTab] = useState<ClubTab>('Overview');
  const loadClub = useClubStore((s) => s.load);
  const clubView = useClubStore((s) => s.clubs[id ?? '']) ?? EMPTY_VIEW;
  const me = (address ?? getCurrentUserId()).toLowerCase();
  const settings = clubView.state?.settings ?? DEFAULT_SETTINGS;
  const isAdmin = isOwner || (clubView.state?.admins ?? []).some((a) => a.toLowerCase() === me);
  const removedMe = (clubView.state?.removed ?? []).some((a) => a.toLowerCase() === me);
  const isActiveMember = (isJoined || isOwner) && !removedMe;
  const myRequest = clubView.state?.requests.find((r) => r.member.toLowerCase() === me);
  const { state: membersState } = useClubMembers(club?.id, club?.owner);
  const memberList = membersState.status === 'ready' ? membersState.members : null;
  const following = useSocialStore((s) => s.following);
  const resolveUser = useUserResolver();
  const nameOf = (who: string) => {
    const user = resolveUser(who);
    return user ? getDisplayName(user) : `${who.slice(0, 6)}…`;
  };
  const followedSet = new Set([...following].map((f) => f.toLowerCase()));
  const joinedByFollowed = (memberList ?? []).filter((m) => followedSet.has(m.toLowerCase()));
  const clubName = (settings.name || club?.name) ?? 'Club';
  const coverImage = settings.cover || settings.photo;
  const coverSource = coverImage
    ? { uri: ipfsToHttpUrl(coverImage) }
    : stockImageFor('club', club?.id ?? '');

  /** Join, leave, or (for an invite-only club) ask to join and wait for an admin. */
  const joinState: 'owner' | 'joined' | 'join' | 'request' | 'requested' = (() => {
    if (isOwner) return 'owner';
    if (isJoined) return 'joined';
    if (!settings.inviteOnly || myRequest?.status === 'approved') return 'join';
    return myRequest?.status === 'pending' ? 'requested' : 'request';
  })();
  const joinLabel = {
    owner: 'You own this club',
    joined: 'Joined — Tap to Leave',
    join: myRequest?.status === 'approved' ? 'Approved — Join Club' : 'Join Club',
    request: 'Request to join',
    requested: 'Request sent',
  }[joinState];

  const transferOwnership = async (member: string) => {
    if (!club) return;
    const result = await run(
      (w) => services.group.transferGroupOwnership(w, BigInt(club.id), member as `0x${string}`),
      { pending: 'Transferring ownership…', success: 'Ownership transferred' }
    );
    if (result?.confirmed) void fetchClubs();
  };

  const { balance: treasuryBalance, refresh: refreshTreasury } = useClubTreasury(club?.id);
  const { eth: balanceWei } = useBalances(address);

  // Shown after a pause in typing; the buttons use the live value so a bad amount never slips through.
  const depositError = treasuryAmountError(depositAmount, balanceWei, 'deposit');
  const withdrawError = treasuryAmountError(withdrawAmount, treasuryBalance, 'withdraw');
  const pausedDeposit = useDebouncedValue(depositAmount, AMOUNT_PAUSE_MS);
  const pausedWithdraw = useDebouncedValue(withdrawAmount, AMOUNT_PAUSE_MS);
  const shownDepositError = treasuryAmountError(pausedDeposit, balanceWei, 'deposit');
  const shownWithdrawError = treasuryAmountError(pausedWithdraw, treasuryBalance, 'withdraw');

  // An amount typed for one club must never be sent to another.
  const clubId = club?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset exactly when the club changes
  useEffect(() => {
    setDepositAmount('');
    setWithdrawAmount('');
  }, [clubId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the club changes
  useEffect(() => {
    if (id) void loadClub(id);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchClubs();
      if (address) fetchJoinedClubs(address);
      refreshTreasury();
    }, [fetchClubs, fetchJoinedClubs, address, refreshTreasury])
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchClubs(),
        address ? fetchJoinedClubs(address) : Promise.resolve(),
        refreshTreasury(),
        id ? loadClub(id) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchClubs, fetchJoinedClubs, address, refreshTreasury, id, loadClub]);

  if (!club) {
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
            <ThemedText type="sectionTitle">Club</ThemedText>
            <View style={{ width: 24 }} />
          </ThemedView>
          <DetailFallback
            what="club"
            loading={clubsLoading}
            error={clubsError}
            onRetry={() => void fetchClubs()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const handleJoinPress = () => {
    if (joinState === 'request') {
      haptics.impactMedium();
      void sendClubChange({ clubId: club.id, action: 'request' });
      return;
    }
    void handleJoin();
  };

  const handleJoin = async () => {
    haptics.impactMedium();
    if (isJoined) {
      confirmLeave('club', club.name, () => void setClubMember(club.id, false));
      return;
    }
    await setClubMember(club.id, true);
  };

  const sendDeposit = async (amountWei: bigint) => {
    if (!club) return;
    setIsTreasuryPending(true);
    try {
      const result = await run(
        (wallet) => services.group.depositToTreasury(wallet, BigInt(club.id), amountWei),
        { pending: 'Contributing to treasury...', success: 'Contributed to treasury' }
      );
      if (result?.confirmed) {
        setDepositAmount('');
        refreshTreasury();
      }
    } finally {
      setIsTreasuryPending(false);
    }
  };

  // Real money leaves the account: spell the amount out, so "5" meant as "0.05" is caught first.
  const handleDeposit = () => {
    if (!club || isTreasuryPending) return;
    const amountWei = parseEthAmount(depositAmount);
    if (amountWei === null || amountWei <= 0n || depositError) return;
    haptics.impactMedium();
    Alert.alert(
      'Contribute to the treasury?',
      `${formatEther(amountWei)} ETH will move from your account to ${club.name}'s shared fund.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contribute', onPress: () => void sendDeposit(amountWei) },
      ]
    );
  };

  const sendWithdraw = async (amountWei: bigint) => {
    if (!club || !address) return;
    setIsTreasuryPending(true);
    try {
      const result = await run(
        (wallet) =>
          services.group.withdrawFromTreasury(
            wallet,
            BigInt(club.id),
            amountWei,
            address as `0x${string}`
          ),
        { pending: 'Withdrawing from treasury...', success: 'Withdrawn from treasury' }
      );
      if (result?.confirmed) {
        setWithdrawAmount('');
        refreshTreasury();
      }
    } finally {
      setIsTreasuryPending(false);
    }
  };

  // The treasury is shared money: spell the amount out before it leaves the fund.
  const handleWithdraw = () => {
    if (!club || !address || isTreasuryPending) return;
    const amountWei = parseEthAmount(withdrawAmount);
    if (amountWei === null || amountWei <= 0n || withdrawError) return;
    haptics.impactMedium();
    Alert.alert(
      'Withdraw from the treasury?',
      `${formatEther(amountWei)} ETH will move from ${club.name}'s shared fund to your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', onPress: () => void sendWithdraw(amountWei) },
      ]
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
          <ThemedText
            type="sectionTitle"
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center' }}
          >
            {clubName}
          </ThemedText>
          <View style={styles.headerActions}>
            <Tappable
              onPress={() => router.push(`/club-invite?id=${club.id}`)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Invite to the club"
            >
              <Ionicons name="person-add-outline" size={22} color={theme.text} />
            </Tappable>
            <ShareButton
              label="Share this club"
              message={`${clubName} on Stryde\n${buildDetailDeepLink('clubs', club.id)}`}
            />
            {(isJoined || isOwner) && (
              <Tappable
                onPress={() => router.push(`/club-settings?id=${club.id}`)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Club settings"
              >
                <Ionicons name="settings-outline" size={22} color={theme.text} />
              </Tappable>
            )}
          </View>
        </ThemedView>

        <ScrollView
          keyboardShouldPersistTaps="handled"
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
              source={coverSource}
              style={styles.cover}
              contentFit="cover"
              // Decorative: the title below names the club.
              accessible={false}
            />
            <ThemedText type="title">{clubName}</ThemedText>
            <ThemedView style={styles.metaRow}>
              <MetaItem
                icon={SPORT_ICON_NAME(club.sportType)}
                text={SPORT_LABEL[club.sportType] || club.sportType}
              />
              <MetaItem
                icon="people-outline"
                text={`${formatMemberCount(club.memberCount)} ${club.memberCount === 1 ? 'member' : 'members'}`}
              />
              <MetaItem
                icon={settings.inviteOnly ? 'lock-closed-outline' : 'globe-outline'}
                text={settings.inviteOnly ? 'Invite only' : 'Public'}
              />
            </ThemedView>
            {settings.location || club.location ? (
              <MetaItem icon="location-outline" text={settings.location || club.location} />
            ) : null}
          </ThemedView>

          {/* An owner's button does nothing, so it is drawn like a joined one, not as the main action. */}
          <Tappable
            style={[
              styles.joinBtn,
              {
                backgroundColor: quiet ? 'transparent' : theme.brand.primary,
                borderColor: quiet ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={handleJoinPress}
            activeOpacity={0.7}
            disabled={isPending || isOwner || joinState === 'requested'}
            accessibilityRole="button"
            accessibilityLabel={`${joinLabel}, ${clubName}`}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={quiet ? theme.textSecondary : Brand.white} />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: quiet ? theme.textSecondary : Brand.white }}
              >
                {joinLabel}
              </ThemedText>
            )}
          </Tappable>

          {joinedByFollowed.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.followedLine}>
              {followedJoinedText(joinedByFollowed.map(nameOf))}
            </ThemedText>
          )}

          <UnderlineTabs
            tabs={CLUB_TABS}
            active={tab}
            onChange={(next) => setTab(next as ClubTab)}
            style={styles.tabs}
          />

          {tab === 'Feed' && (
            <ClubFeed
              clubId={club.id}
              posts={clubView.feed}
              me={me}
              isMember={isActiveMember}
              isAdmin={isAdmin}
              adminsOnlyPost={settings.adminsOnlyPost}
              loading={clubView.loading}
              error={clubView.error}
              onRetry={() => void loadClub(club.id)}
            />
          )}
          {tab === 'Leaderboard' && (
            <ClubLeaderboard
              members={memberList}
              me={me}
              hidden={!settings.showLeaderboard}
              isMember={isActiveMember}
            />
          )}
          {tab === 'Members' && (
            <ClubMembersPanel
              clubId={club.id}
              members={memberList}
              state={clubView.state}
              me={me}
              isOwner={isOwner}
              isAdmin={isAdmin}
              onTransferOwnership={(member) => void transferOwnership(member)}
            />
          )}

          {tab === 'Overview' && (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  About
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.text }}>
                  {settings.description || club.description}
                </ThemedText>
              </ThemedView>

              <ClubMembers clubId={club.id} owner={club.owner} />

              <ThemedView
                style={[styles.treasuryCard, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedView style={styles.treasuryHeader}>
                  <Ionicons name="wallet-outline" size={18} color={theme.brand.primary} />
                  <ThemedText type="eyebrow" themeColor="textSecondary">
                    Club Treasury
                  </ThemedText>
                </ThemedView>
                <ThemedText style={[styles.treasuryBalance, { color: theme.text }]}>
                  {treasuryBalance === null ? '—' : `${formatEther(treasuryBalance)} ETH`}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginBottom: Spacing.two }}
                >
                  Shared funds owned by the club, not by any one member.
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginBottom: Spacing.two }}
                >
                  Anyone can contribute. Only the club owner can withdraw.
                </ThemedText>

                <ThemedView style={styles.treasuryRow}>
                  <View style={styles.treasuryInput}>
                    <TextField
                      placeholder="0.0 ETH"
                      value={depositAmount}
                      onChangeText={setDepositAmount}
                      keyboardType="decimal-pad"
                      error={shownDepositError}
                      accessibilityLabel="Amount to contribute"
                    />
                  </View>
                  <AppButton
                    variant="secondary"
                    fullWidth={false}
                    style={styles.treasuryBtn}
                    onPress={handleDeposit}
                    disabled={
                      !wallet ||
                      isTreasuryPending ||
                      parseEthAmount(depositAmount) === null ||
                      depositError !== null
                    }
                    loading={isTreasuryPending}
                  >
                    Contribute
                  </AppButton>
                </ThemedView>

                {isOwner && (
                  <ThemedView style={[styles.treasuryRow, { marginTop: Spacing.two }]}>
                    <View style={styles.treasuryInput}>
                      <TextField
                        placeholder="0.0 ETH"
                        value={withdrawAmount}
                        onChangeText={setWithdrawAmount}
                        keyboardType="decimal-pad"
                        error={shownWithdrawError}
                        accessibilityLabel="Amount to withdraw"
                      />
                    </View>
                    <AppButton
                      variant="secondary"
                      fullWidth={false}
                      style={styles.treasuryBtn}
                      onPress={handleWithdraw}
                      disabled={
                        !wallet ||
                        isTreasuryPending ||
                        parseEthAmount(withdrawAmount) === null ||
                        withdrawError !== null
                      }
                      loading={isTreasuryPending}
                    >
                      Withdraw
                    </AppButton>
                  </ThemedView>
                )}
              </ThemedView>

              <ClubEventsSection eventIds={clubView.state?.events ?? []} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  followedLine: { textAlign: 'center' },
  tabs: { marginBottom: Spacing.two },
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
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  cover: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.lg,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  section: {
    gap: Spacing.two,
  },
  treasuryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  treasuryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  treasuryBalance: {
    ...textStyle(TypeScale.titleSmall),
  },
  treasuryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  treasuryInput: {
    flex: 1,
  },
  treasuryBtn: {
    width: 130,
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
