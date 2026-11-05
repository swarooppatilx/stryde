import { Ionicons } from '@expo/vector-icons';
import { getActiveConfig, services } from '@repo/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WalletClient } from 'viem';
import { formatEther } from 'viem';
import { AppButton } from '@/components/button';
import { ChallengeStandings } from '@/components/challenge-standings';
import { ListMessage } from '@/components/list-message';
import { shimmerPresetFor } from '@/components/Shimmer/const';
import { Shimmer } from '@/components/Shimmer/Shimmer';
import { ShareButton } from '@/components/share-button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getChainMode } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useChainAction } from '@/hooks/useChainAction';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useEnsName } from '@/hooks/useEnsName';
import { useGoBack } from '@/hooks/useGoBack';
import { useSocialUser } from '@/hooks/useSocialUser';
import { useWithdrawnStore } from '@/stores/withdrawnStore';
import { Alert } from '@/utils/alert';
import { CHALLENGE_STATUS_LABEL, challengeStatusColor } from '@/utils/challengeFilter';
import { formatDateTime } from '@/utils/dates';
import { buildDetailDeepLink } from '@/utils/deepLink';
import { getParsedError } from '@/utils/errors';
import { formatDistance, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

type OnchainChallenge = NonNullable<Awaited<ReturnType<typeof services.challenge.getChallenge>>>;

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const theme = useTheme();
  const currentUserId = useCurrentUserId().toLowerCase();
  const unitSystem = useUnitSystem();
  const { run } = useChainAction();

  const [challenge, setChallenge] = useState<OnchainChallenge | null>(null);
  const challengeRef = useRef<OnchainChallenge | null>(null);
  challengeRef.current = challenge;
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasWithdrawn = useWithdrawnStore((s) => !!id && s.ids.includes(id));
  const markWithdrawn = useWithdrawnStore((s) => s.markWithdrawn);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const load = useCallback(async () => {
    // The id arrives from a deep link or stale nav state, so it can be anything at all.
    // A non-numeric id is not a challenge id, and BigInt('abc') would throw its way out
    // of the loading state and leave this screen shimmering forever.
    if (!id || !/^\d+$/.test(id)) {
      setChallenge(null);
      setLoadError(null);
      return;
    }
    try {
      // getChallenge answers null for an id the registry never issued, which is the
      // "no such challenge" case — distinct from the request failing.
      setChallenge(await services.challenge.getChallenge(BigInt(id)));
      setLoadError(null);
    } catch (e) {
      logger.warn('[Challenge] Failed to load:', e);
      if (challengeRef.current) {
        // A refresh that fails keeps what is already on screen instead of replacing it with an error page.
        Toast.fail("Couldn't refresh. Showing what we had.", 2);
      } else {
        setLoadError('Failed to load this challenge. Check your connection and try again.');
      }
    }
  }, [id]);

  const reload = useCallback(() => {
    setIsLoading(true);
    return load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const challengerEnsName = useEnsName(challenge?.challenger);
  const opponentEnsName = useEnsName(challenge?.opponent);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const challengerUser = useSocialUser(challenge?.challenger);
  const opponentUser = useSocialUser(challenge?.opponent);

  // Live progress for a running or finished challenge; best effort, since it scans chain logs.
  const [standings, setStandings] = useState<{ challenger: number; opponent: number } | null>(null);
  const standingsChallenge =
    challenge && challenge.status >= 1 && challenge.status <= 2 ? challenge : null;
  useEffect(() => {
    if (!standingsChallenge) {
      setStandings(null);
      return;
    }
    let cancelled = false;
    services.challenge
      .getChallengeStandings(standingsChallenge)
      .then((result) => {
        if (!cancelled) setStandings(result);
      })
      .catch((error) => logger.warn('[Challenge] Failed to load standings:', error));
    return () => {
      cancelled = true;
    };
  }, [standingsChallenge]);

  if (!challenge) {
    const shimmerPreset = shimmerPresetFor(theme.isDark);
    const fallbackBody = () => {
      if (isLoading) {
        return (
          <ThemedView style={styles.scroll}>
            <ThemedView style={styles.vsRow}>
              <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonName} />
              <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonVs} />
              <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonName} />
            </ThemedView>
            <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonStatsRow} />
            <Shimmer isLoading preset={shimmerPreset} style={styles.skeletonCaption} />
          </ThemedView>
        );
      }
      if (loadError) {
        return (
          <ListMessage
            fill
            icon="alert-circle-outline"
            text={loadError}
            action={{ label: 'Retry', onPress: reload }}
          />
        );
      }
      return <ListMessage fill icon="search-outline" text="Challenge not found" />;
    };
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* The fallback states need the header too — otherwise a bad link is a
              dead end with no way back. */}
          <ThemedView style={styles.header}>
            <Tappable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Tappable>
            <ThemedText type="sectionTitle">Challenge</ThemedText>
            <View style={{ width: 24 }} />
          </ThemedView>
          {fallbackBody()}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isChallenger = challenge.challenger.toLowerCase() === currentUserId;
  const isOpponent = challenge.opponent.toLowerCase() === currentUserId;
  const challengerName =
    challengerEnsName ||
    (challengerUser ? getDisplayName(challengerUser) : `${challenge.challenger.slice(0, 6)}...`);
  const opponentName =
    opponentEnsName ||
    (opponentUser ? getDisplayName(opponentUser) : `${challenge.opponent.slice(0, 6)}...`);
  const statusLabel = CHALLENGE_STATUS_LABEL[challenge.status] ?? 'Unknown';
  const deadlinePassed = Date.now() / 1000 > challenge.deadline;
  const isWinner = challenge.status === 2 && challenge.winner.toLowerCase() === currentUserId;
  const isLoser =
    challenge.status === 2 &&
    (isChallenger || isOpponent) &&
    challenge.winner.toLowerCase() !== currentUserId;

  const runAction = async (
    write: (wallet: WalletClient) => Promise<{ confirmed: boolean; txHash?: `0x${string}` }>,
    labels: { pending: string; success: string },
    onConfirmed?: () => void
  ) => {
    setIsBusy(true);
    try {
      const result = await run(write, labels);
      if (result?.confirmed) {
        onConfirmed?.();
        if (result.txHash) setLastTxHash(result.txHash);
        await load();
      }
    } finally {
      setIsBusy(false);
    }
  };

  // Accepting sends the stake from this wallet: spell out what is being committed.
  const handleAccept = () => {
    haptics.impactMedium();
    const ends = formatDateTime(challenge.deadline * 1000);
    Alert.alert(
      'Accept challenge?',
      `You put up ${formatEther(challenge.stake)} ETH against ${challengerName}. ` +
        `Whoever covers more distance by ${ends} wins both stakes.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () =>
            runAction(
              (wallet) => services.challenge.acceptChallenge(wallet, challenge.id, challenge.stake),
              { pending: 'Accepting challenge...', success: 'Challenge accepted' }
            ),
        },
      ]
    );
  };

  const handleCancel = () => {
    haptics.tap();
    Alert.alert('Cancel this challenge?', 'It will no longer be open for anyone to accept.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel challenge',
        style: 'destructive',
        onPress: () =>
          runAction((wallet) => services.challenge.cancelChallenge(wallet, challenge.id), {
            pending: 'Cancelling...',
            success: 'Challenge cancelled',
          }),
      },
    ]);
  };

  const handleSettle = async () => {
    haptics.impactMedium();
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
      const result = await run(() => services.challenge.settleChallenge(challenge.id), {
        pending: 'Settling challenge...',
        success: 'Challenge settled',
      });
      if (result?.confirmed) {
        if (result.txHash) setLastTxHash(result.txHash);
        await load();
      }
    } catch (error) {
      logger.error('[ChallengeDetail] Failed to determine winner:', error);
      Toast.fail(getParsedError(error), 3);
    } finally {
      setIsBusy(false);
    }
  };

  // Moving funds is not something one stray tap should do: say how much and ask first.
  const handleWithdraw = () => {
    haptics.impactMedium();
    // A winner takes both stakes; anyone else is only getting their own back.
    const amount = isWinner ? challenge.stake * 2n : challenge.stake;
    Alert.alert(
      isWinner ? 'Withdraw your winnings?' : 'Reclaim your stake?',
      `${formatEther(amount)} ETH will be sent to your account.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: isWinner ? 'Withdraw' : 'Reclaim',
          onPress: () => {
            void runAction(
              (wallet) => services.challenge.withdrawStake(wallet, challenge.id),
              { pending: 'Withdrawing...', success: 'Withdrawn' },
              () => {
                haptics.success();
                if (id) markWithdrawn(id);
              }
            );
          },
        },
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
          <ThemedText type="sectionTitle">Challenge</ThemedText>
          <ShareButton
            label="Share this challenge"
            message={`A challenge on Stryde\n${buildDetailDeepLink('challenges', String(challenge?.id ?? id ?? ''))}`}
          />
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
            <ThemedText type="sectionTitle" themeColor="textSecondary">
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
              <ThemedText type="caption" themeColor="textSecondary">
                Target
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {formatEther(challenge.stake)} ETH
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Stake each
              </ThemedText>
            </ThemedView>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <ThemedText
                style={[styles.statValue, { color: theme[challengeStatusColor(challenge.status)] }]}
              >
                {statusLabel}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Status
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            {deadlinePassed
              ? 'Deadline passed'
              : `Ends ${formatDateTime(challenge.deadline * 1000)}`}
          </ThemedText>

          {standings && (
            <ChallengeStandings
              challenger={{
                name: challengerName,
                distance: standings.challenger,
                isMe: isChallenger,
              }}
              opponent={{ name: opponentName, distance: standings.opponent, isMe: isOpponent }}
              target={Number(challenge.targetMetric)}
              unitSystem={unitSystem}
            />
          )}

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
            getChainMode() !== 'local' &&
            (() => {
              const explorerUrl = `${getActiveConfig().chain.blockExplorers?.default.url}/tx/${lastTxHash}`;
              return (
                <Tappable onPress={() => Linking.openURL(explorerUrl)} style={styles.explorerLink}>
                  <ThemedText type="small" style={{ color: theme.accentText }}>
                    View on Explorer ↗
                  </ThemedText>
                </Tappable>
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
    ...textStyle(TypeScale.bodyBold),
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
