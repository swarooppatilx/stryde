import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';

import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV, getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useSocialStore } from '@/stores/socialStore';
import { formatDistance, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

type OnchainChallenge = Awaited<ReturnType<typeof services.challenge.getChallenge>>;

const STATUS_LABEL = ['Open', 'Accepted', 'Settled', 'Cancelled'];

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { wallet } = useViemWallet(ENV.CHAIN_MODE);
  const getUserById = useSocialStore((s) => s.getUserById);

  const [challenge, setChallenge] = useState<OnchainChallenge | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setChallenge(await services.challenge.getChallenge(BigInt(id)));
    } catch {
      setChallenge(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!challenge) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.empty}>
            <ActivityIndicator size="large" />
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
  const challengerName = challengerUser
    ? getDisplayName(challengerUser)
    : `${challenge.challenger.slice(0, 6)}...`;
  const opponentName = opponentUser
    ? getDisplayName(opponentUser)
    : `${challenge.opponent.slice(0, 6)}...`;
  const statusLabel = STATUS_LABEL[challenge.status] ?? 'Unknown';
  const deadlinePassed = Date.now() / 1000 > challenge.deadline;
  const isWinner = challenge.status === 2 && challenge.winner.toLowerCase() === currentUserId;
  const isLoser =
    challenge.status === 2 &&
    (isChallenger || isOpponent) &&
    challenge.winner.toLowerCase() !== currentUserId;

  const runAction = async (action: () => Promise<{ confirmed: boolean }>, failMessage: string) => {
    if (!wallet) return;
    setIsBusy(true);
    try {
      const { confirmed } = await action();
      if (!confirmed) throw new Error('not confirmed');
      await load();
    } catch (err) {
      console.warn('[ChallengeDetail] action failed', err);
      Alert.alert('Action failed', failMessage);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAccept = () => {
    haptics.impactMedium();
    if (!wallet) return;
    runAction(
      () => services.challenge.acceptChallenge(wallet, challenge.id, challenge.stake),
      'Could not accept the challenge. Make sure you have enough ETH to match the stake.'
    );
  };

  const handleCancel = () => {
    haptics.tap();
    if (!wallet) return;
    runAction(() => services.challenge.cancelChallenge(wallet, challenge.id), 'Could not cancel.');
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
      const { confirmed } = await services.challenge.settleChallenge(wallet, challenge.id, winner);
      if (!confirmed) throw new Error('not confirmed');
      await load();
    } catch (err) {
      console.warn('[ChallengeDetail] settle failed', err);
      Alert.alert('Settle failed', 'Could not settle the challenge.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleWithdraw = () => {
    haptics.success();
    if (!wallet) return;
    runAction(
      () => services.challenge.withdrawStake(wallet, challenge.id),
      'Could not withdraw. It may already be claimed.'
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                {formatDistance(Number(challenge.targetMetric))}
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
          {challenge.status === 0 && isChallenger && deadlinePassed && (
            <AppButton onPress={handleWithdraw} disabled={isBusy}>
              Reclaim Stake
            </AppButton>
          )}
          {challenge.status === 1 && (isChallenger || isOpponent) && (
            <AppButton onPress={handleSettle} disabled={isBusy}>
              {isBusy ? 'Settling...' : 'Settle Challenge'}
            </AppButton>
          )}
          {isWinner && (
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 15,
    fontWeight: '700',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
});
