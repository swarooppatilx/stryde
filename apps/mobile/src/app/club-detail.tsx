import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther, parseEther } from 'viem';

import { AppButton } from '@/components/button';
import { TextField } from '@/components/text-field';
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

function parseAmountToWei(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const getClubById = useCommunityStore((s) => s.getClubById);
  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const applyClubMembership = useCommunityStore((s) => s.applyClubMembership);
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);

  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();
  const [isPending, setIsPending] = useState(false);

  // Group Treasury: a shared organization wallet for the club, distinct from
  // any individual member's own wallet — funded via depositToTreasury (any
  // wallet, member or not) and spent from via withdrawFromTreasury (owner
  // only). Both route through the same gasless Privy smart-account `wallet`
  // used for every other write on this screen.
  const [treasuryBalance, setTreasuryBalance] = useState<bigint | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isTreasuryPending, setIsTreasuryPending] = useState(false);

  const club = getClubById(id ?? '');
  const isJoined = club ? joinedClubIds.includes(club.id) : false;
  const isOwner = !!(club && address && club.owner.toLowerCase() === address.toLowerCase());

  const refreshTreasury = useCallback(() => {
    if (!club) return;
    services.group
      .getGroupTreasury(BigInt(club.id))
      .then(setTreasuryBalance)
      .catch((e) => console.warn('[ClubDetail] Failed to fetch treasury balance:', e));
  }, [club]);

  useFocusEffect(
    useCallback(() => {
      fetchClubs();
      if (address) fetchJoinedClubs(address);
      refreshTreasury();
    }, [fetchClubs, fetchJoinedClubs, address, refreshTreasury])
  );

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

  const handleJoin = async () => {
    if (!wallet || !address || isPending) return;
    haptics.impactMedium();

    setIsPending(true);
    try {
      const result = await transact(
        () =>
          isJoined
            ? services.group.leaveGroup(wallet, BigInt(club.id))
            : services.group.joinGroup(wallet, BigInt(club.id)),
        {
          pending: isJoined ? 'Leaving club...' : 'Joining club...',
          success: isJoined ? 'Left club' : 'Joined club',
        }
      );
      if (result?.confirmed) {
        applyClubMembership(club.id, !isJoined);
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleDeposit = async () => {
    if (!wallet || !club || isTreasuryPending) return;
    const amountWei = parseAmountToWei(depositAmount);
    if (amountWei === null || amountWei <= 0n) return;
    haptics.impactMedium();

    setIsTreasuryPending(true);
    try {
      const result = await transact(
        () => services.group.depositToTreasury(wallet, BigInt(club.id), amountWei),
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

  const handleWithdraw = async () => {
    if (!wallet || !club || !address || isTreasuryPending) return;
    const amountWei = parseAmountToWei(withdrawAmount);
    if (amountWei === null || amountWei <= 0n) return;
    haptics.impactMedium();

    setIsTreasuryPending(true);
    try {
      const result = await transact(
        () =>
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

          {/* Group Treasury */}
          <ThemedView style={[styles.treasuryCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.treasuryHeader}>
              <Ionicons name="wallet-outline" size={18} color={theme.brand.primary} />
              <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
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
              Shared, on-chain funds owned by the club — not any one member's wallet.
            </ThemedText>

            <ThemedView style={styles.treasuryRow}>
              <View style={styles.treasuryInput}>
                <TextField
                  placeholder="Amount (ETH)"
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <AppButton
                variant="secondary"
                onPress={handleDeposit}
                disabled={!wallet || isTreasuryPending || parseAmountToWei(depositAmount) === null}
                loading={isTreasuryPending}
              >
                Contribute
              </AppButton>
            </ThemedView>

            {isOwner && (
              <ThemedView style={[styles.treasuryRow, { marginTop: Spacing.two }]}>
                <View style={styles.treasuryInput}>
                  <TextField
                    placeholder="Amount (ETH)"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
                <AppButton
                  variant="secondary"
                  onPress={handleWithdraw}
                  disabled={
                    !wallet || isTreasuryPending || parseAmountToWei(withdrawAmount) === null
                  }
                  loading={isTreasuryPending}
                >
                  Withdraw
                </AppButton>
              </ThemedView>
            )}
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
            disabled={isPending || !wallet}
            accessibilityRole="button"
            accessibilityLabel={isJoined ? `Leave ${club.name}` : `Join ${club.name}`}
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
                {isJoined ? 'Joined — Tap to Leave' : 'Join Club'}
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
    fontSize: 24,
    fontWeight: '700',
  },
  treasuryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  treasuryInput: {
    flex: 1,
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
