import { Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActiveConfig, services } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { AppButton } from '@/components/button';
import { Shimmer } from '@/components/Shimmer/Shimmer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV, getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useEnsName } from '@/hooks/useEnsName';
import { useTransactor } from '@/hooks/useTransactor';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useSocialStore } from '@/stores/socialStore';
import { getParsedError } from '@/utils/errors';
import { formatDistance, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

type OnchainChallenge = Awaited<ReturnType<typeof services.challenge.getChallenge>>;

const STATUS_LABEL = ['Open', 'Accepted', 'Settled', 'Cancelled'];

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const { wallet } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();
  const getUserById = useSocialStore((s) => s.getUserById);

  const [challenge, setChallenge] = useState<OnchainChallenge | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasWithdrawn, setHasWithdrawn] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setChallenge(await services.challenge.getChallenge(BigInt(id)));
    } catch (e) {
      console.warn('[Challenge] Failed to load:', e);
      setChallenge(null);
    }
  }, [id]);

  useEffect(() => {
    setHasWithdrawn(false);
    load();
  }, [load]);

  const challengerEnsName = useEnsName(challenge?.challenger);
  const opponentEnsName = useEnsName(challenge?.opponent);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  if (!challenge) {
    const shimmerPreset = theme.isDark ? 'dark' : 'light';
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.scroll}>
            <ThemedView style={styles.vsRow}>
              <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonName} />
              <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonVs} />
              <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonName} />
            </ThemedView>
            <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonStatsRow} />
            <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonCaption} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const currentUserId = getCurrentUserId().toLowerCase();
  const isChallenger = challenge.challenger.toLowerCase() === currentUserId;
  const isOpponent = challenge.opponent.toLowerCase() === currentUserId;
  const challengerUser = getUserById(challenge.challenger);
  const opponentUser = getUserById(challenge.opponent);
  const challengerName =
    challengerEnsName ||
    (challengerUser ? getDisplayName(challengerUser) : `${challenge.challenger.slice(0, 6)}...`);
  const opponentName =
    opponentEnsName ||
    (opponentUser ? getDisplayName(opponentUser) : `${challenge.opponent.slice(0, 6)}...`);
  const statusLabel = STATUS_LABEL[challenge.status] ?? 'Unknown';
  const deadlinePassed = Date.now() / 1000 > challenge.deadline;
  const isWinner = challenge.status === 2 && challenge.winner.toLowerCase() === currentUserId;
  const isLoser =
    challenge.status === 2 &&
    (isChallenger || isOpponent) &&
    challenge.winner.toLowerCase() !== currentUserId;

  const runAction = async (
    action: () => Promise<{ confirmed: boolean; txHash?: `0x${string}` }>,
    labels: { pending: string; success: string },
    onConfirmed?: () => void
  ) => {
    if (!wallet) return;
    setIsBusy(true);
    try {
      const result = await transact(action, labels);
      if (result?.confirmed) {
        onConfirmed?.();
        if (result.txHash) setLastTxHash(result.txHash);
        await load();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleAccept = () => {
    haptics.impactMedium();
    if (!wallet) return;
    runAction(() => services.challenge.acceptChallenge(wallet, challenge.id, challenge.stake), {
      pending: 'Accepting challenge...',
      success: 'Challenge accepted',
    });
  };

  const handleCancel = () => {
    haptics.tap();
    if (!wallet) return;
    runAction(() => services.challenge.cancelChallenge(wallet, challenge.id), {
      pending: 'Cancelling...',
      success: 'Challenge cancelled',
    });
  };

  const handleSettle = async () => {
    haptics.impactMedium();
    if (!wallet) return;
    setIsBusy(true);
    try {
      const winner = await services.challenge.determineWinner(challenge);
      if (!winner) {
        Alert.alert(
          'Too close to call',
          'Both sides have covered the same distance so far — nothing to settle yet.'
        );
        return;
      }
      const result = await transact(
        () => services.challenge.settleChallenge(wallet, challenge.id, winner),
        { pending: 'Settling challenge...', success: 'Challenge settled' }
      );
      if (result?.confirmed) {
        if (result.txHash) setLastTxHash(result.txHash);
        await load();
      }
    } catch (error) {
      console.error('[ChallengeDetail] Failed to determine winner:', error);
      Toast.fail(getParsedError(error), 3);
    } finally {
      setIsBusy(false);
    }
  };

  const handleWithdraw = () => {
    haptics.success();
    if (!wallet) return;
    runAction(
      () => services.challenge.withdrawStake(wallet, challenge.id),
      { pending: 'Withdrawing...', success: 'Withdrawn' },
      () => setHasWithdrawn(true)
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="sectionTitle">Challenge</ThemedText>
          <View style={{ width: 24 }} />
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
          <ThemedView style={styles.vsRow}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.vsSide}>
              {isChallenger ? 'You' : challengerName}
            </ThemedText>
            <ThemedText type="sectionTitle" style={{ color: theme.textSecondary }}>
              vs
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} style={[styles.vsSide, styles.vsRight]}>
              {isOpponent ? 'You' : opponentName}
            </ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatDistance(Number(challenge.targetMetric), unitSystem)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Target
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatEther(challenge.stake)} ETH
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Stake each
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.brand.primary }]}>
                {statusLabel}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Status
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            {deadlinePassed
              ? 'Deadline passed'
              : `Ends ${new Date(challenge.deadline * 1000).toLocaleDateString()}`}
          </ThemedText>

          {isWinner && (
            <ThemedText
              type="smallBold"
              style={{ color: theme.brand.success, textAlign: 'center' }}
            >
              You won this challenge! 🎉
            </ThemedText>
          )}
          {isLoser && (
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
              You lost this challenge.
            </ThemedText>
          )}

          {lastTxHash &&
            ENV.CHAIN_MODE !== 'local' &&
            (() => {
              const explorerUrl = `${getActiveConfig().chain.blockExplorers?.default.url}/tx/${lastTxHash}`;
              return (
                <TouchableOpacity
                  onPress={() => Linking.openURL(explorerUrl)}
                  style={styles.explorerLink}
                >
                  <ThemedText type="small" style={{ color: theme.brand.primary }}>
                    View on Explorer ↗
                  </ThemedText>
                </TouchableOpacity>
              );
            })()}

          {challenge.status === 0 && isOpponent && (
            <AppButton onPress={handleAccept} disabled={isBusy}>
              {isBusy ? 'Accepting...' : 'Accept & Match Stake'}
            </AppButton>
          )}
          {challenge.status === 0 && isChallenger && !deadlinePassed && (
            <AppButton onPress={handleCancel} disabled={isBusy} variant="secondary">
              Cancel Challenge
            </AppButton>
          )}
          {challenge.status === 0 && isChallenger && deadlinePassed && !hasWithdrawn && (
            <AppButton onPress={handleWithdraw} disabled={isBusy}>
              {isBusy ? 'Withdrawing...' : 'Reclaim Stake'}
            </AppButton>
          )}
          {challenge.status === 1 && (isChallenger || isOpponent) && !deadlinePassed && (
            <AppButton onPress={handleSettle} disabled={isBusy}>
              {isBusy ? 'Settling...' : 'Settle Challenge'}
            </AppButton>
          )}
          {challenge.status === 1 &&
            (isChallenger || isOpponent) &&
            deadlinePassed &&
            !hasWithdrawn && (
              <AppButton onPress={handleWithdraw} disabled={isBusy}>
                {isBusy ? 'Withdrawing...' : 'Reclaim Stake'}
              </AppButton>
            )}
          {isWinner && !hasWithdrawn && (
            <AppButton onPress={handleWithdraw} disabled={isBusy}>
              {isBusy ? 'Withdrawing...' : 'Withdraw Winnings'}
            </AppButton>
          )}
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
  skeletonName: {
    flex: 1,
    height: 20,
    borderRadius: BorderRadius.sm,
  },
  skeletonVs: {
    width: 28,
    height: 20,
    marginHorizontal: Spacing.two,
    borderRadius: BorderRadius.sm,
  },
  skeletonStatsRow: {
    height: 72,
    borderRadius: BorderRadius.lg,
  },
  skeletonCaption: {
    width: 160,
    height: 14,
    borderRadius: BorderRadius.sm,
    alignSelf: 'center',
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
  },
  vsSide: { flex: 1 },
  vsRight: { textAlign: 'right' },
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
  explorerLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
