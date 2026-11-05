import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { clubKey, setClubMember } from '@/backends/membership';
import { AppButton } from '@/components/button';
import { ClubMembers } from '@/components/club-members';
import { DetailFallback } from '@/components/list-message';
import { ShareButton } from '@/components/share-button';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useBalances } from '@/hooks/useBalances';
import { useChainAction } from '@/hooks/useChainAction';
import { useClubTreasury } from '@/hooks/useClubTreasury';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGoBack } from '@/hooks/useGoBack';
import { useDelivery } from '@/hooks/useOutbox';
import { useCommunityStore } from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import { Alert } from '@/utils/alert';
import { confirmLeave } from '@/utils/confirmLeave';
import { buildDetailDeepLink } from '@/utils/deepLink';
import { parseEthAmount } from '@/utils/eth';
import { formatMemberCount, SPORT_LABEL } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { treasuryAmountError } from '@/utils/stakeAlerts';

/** How long typing must pause before an amount is judged, so "0." on the way to "0.05" is not an error. */
const AMOUNT_PAUSE_MS = 500;

const SPORT_ICON_NAME = (sport: ActivityType | 'multi'): keyof typeof Ionicons.glyphMap => {
  if (sport === 'multi') return 'fitness';
  return (SPORT_ICONS[sport] ?? 'walk') as keyof typeof Ionicons.glyphMap;
};

function joinAccessibilityLabel(clubName: string, isOwner: boolean, isJoined: boolean): string {
  if (isOwner) return `You own ${clubName}`;
  return isJoined ? `Leave ${clubName}` : `Join ${clubName}`;
}

function joinButtonLabel(isOwner: boolean, isJoined: boolean): string {
  if (isOwner) return 'You own this club';
  return isJoined ? 'Joined — Tap to Leave' : 'Join Club';
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
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
  const isOwner = !!(club && address && club.owner.toLowerCase() === address.toLowerCase());

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
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchClubs, fetchJoinedClubs, address, refreshTreasury]);

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
            {club.name}
          </ThemedText>
          <ShareButton
            label="Share this club"
            message={`${club.name} on Stryde\n${buildDetailDeepLink('clubs', club.id)}`}
          />
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
            <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
              <Ionicons
                name={SPORT_ICON_NAME(club.sportType)}
                size={28}
                color={theme.brand.primary}
              />
            </ThemedView>
            <ThemedText type="title">{club.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {club.location}
            </ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatMemberCount(club.memberCount)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Members
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {SPORT_LABEL[club.sportType] || club.sportType}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Sport
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              About
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.text }}>
              {club.description}
            </ThemedText>
          </ThemedView>

          <ClubMembers clubId={club.id} owner={club.owner} />

          <ThemedView style={[styles.treasuryCard, { backgroundColor: theme.backgroundElement }]}>
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

          <Tappable
            style={[
              styles.joinBtn,
              {
                backgroundColor: isJoined ? 'transparent' : theme.brand.primary,
                borderColor: isJoined ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={handleJoin}
            activeOpacity={0.7}
            disabled={isPending || isOwner}
            accessibilityRole="button"
            accessibilityLabel={joinAccessibilityLabel(club.name, isOwner, isJoined)}
          >
            {isPending ? (
              <ActivityIndicator
                size="small"
                color={isJoined ? theme.textSecondary : Brand.white}
              />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: isJoined ? theme.textSecondary : Brand.white }}
              >
                {joinButtonLabel(isOwner, isJoined)}
              </ThemedText>
            )}
          </Tappable>
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
    borderRadius: BorderRadius.full,
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
    ...textStyle(TypeScale.bodyBold),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
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
