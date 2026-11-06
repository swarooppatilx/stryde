import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { AppButton } from '@/components/button';
import { LookAlikeNotice } from '@/components/look-alike-notice';
import { Notice } from '@/components/notice';
import { SearchBar } from '@/components/search-bar';
import { SportField } from '@/components/sport-field';
import { StakeConfirm } from '@/components/stake-confirm';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportLabel } from '@/constants/activity';
import { getCurrentUserId } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useBalances } from '@/hooks/useBalances';
import { useChainAction } from '@/hooks/useChainAction';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useEnsVerified, useTypedEns } from '@/hooks/useEnsChecks';
import { useEnsName } from '@/hooks/useEnsName';
import { useGoBack } from '@/hooks/useGoBack';
import { useShake } from '@/hooks/useShake';
import type { ActivityType } from '@/types';
import { sameAddress, shortAddress } from '@/utils/address';
import { opponentLabel, validateChallenge } from '@/utils/challengeForm';
import {
  ENS_PROBLEM_COPY,
  findLookAlike,
  isNewCounterparty,
  type KnownAthlete,
} from '@/utils/counterpartyChecks';
import { distanceUnitLabel, metersPerDistanceUnit } from '@/utils/distanceUnits';
import { formatEthAmount } from '@/utils/eth';
import { formatDistance, getInitials } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { opponentFromQuery } from '@/utils/opponentFromQuery';
import { canConfirmStake, stakeAlerts } from '@/utils/stakeAlerts';

interface Opponent {
  wallet: string;
  username: string;
}

/** A person from the registered list; `isVerified` is unknown for someone who is not on it. */
interface KnownOpponent extends Opponent {
  isVerified?: boolean;
}

type ChallengeHistory = Awaited<ReturnType<typeof services.challenge.getUserChallenges>>;

const DAYS_OPTIONS = [1, 3, 7, 14, 30];
const DAY_SECONDS = 24 * 60 * 60;

export default function CreateChallengeScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const { address, run } = useChainAction();
  const unitSystem = useUnitSystem();
  const metersPerUnit = metersPerDistanceUnit(unitSystem);

  const [opponents, setOpponents] = useState<KnownOpponent[] | null>(null);
  const [opponentsFailed, setOpponentsFailed] = useState(false);
  const [opponentQuery, setOpponentQuery] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const { allowLeave } = useDiscardGuard(selectedOpponent !== null);
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [targetKm, setTargetKm] = useState('5');
  const [durationDays, setDurationDays] = useState(7);
  const [stakeEth, setStakeEth] = useState('0.01');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { eth: balanceWei } = useBalances(address);
  const selectedOpponentEnsName = useEnsName(selectedOpponent?.wallet);
  const selectedNameConfirmed = useEnsVerified(selectedOpponentEnsName, selectedOpponent?.wallet);
  const typedEns = useTypedEns(addressInput);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [history, setHistory] = useState<ChallengeHistory | null>(null);
  const opponentShake = useShake();
  const stakeShake = useShake();

  const loadOpponents = useCallback(() => {
    let cancelled = false;
    setOpponentsFailed(false);
    setOpponents(null);
    services.profile
      .getRegisteredUsers()
      .then((users) => {
        if (cancelled) return;
        const currentUserId = getCurrentUserId();
        setOpponents(
          users
            .filter((u) => u.wallet.toLowerCase() !== currentUserId.toLowerCase())
            .map((u) => ({ wallet: u.wallet, username: u.username, isVerified: u.isVerified }))
        );
      })
      .catch((e) => {
        // A failed read is not "nobody to challenge": say so and offer Retry.
        logger.warn('[CreateChallenge] Failed to load users:', e);
        if (!cancelled) setOpponentsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadOpponents(), [loadOpponents]);

  // Who the athlete has dealt with before. Read in the background: the form never waits on it.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    services.challenge
      .getUserChallenges(address)
      .then((list) => {
        if (!cancelled) setHistory(list);
      })
      .catch((e) => logger.warn('[CreateChallenge] Failed to load challenge history:', e));
    return () => {
      cancelled = true;
    };
  }, [address]);

  const pastCounterparties = useMemo(
    () =>
      (history ?? []).map((c) =>
        sameAddress(c.challenger, getCurrentUserId()) ? c.opponent : c.challenger
      ),
    [history]
  );

  // Everyone the athlete could mistake a typed address for: the list, and people from past challenges.
  const knownAthletes = useMemo<KnownAthlete[]>(() => {
    const listed = opponents ?? [];
    const others = pastCounterparties
      .filter((w) => !listed.some((o) => sameAddress(o.wallet, w)))
      .map((wallet) => ({ wallet, username: shortAddress(wallet) }));
    return [...listed, ...others];
  }, [opponents, pastCounterparties]);

  // Someone who has not signed up here yet (or a list that would not load) can still be challenged by address.
  const typedOpponent = useMemo(
    () => opponentFromQuery(addressInput, opponents ?? [], getCurrentUserId()),
    [addressInput, opponents]
  );

  // A name that resolved offers the same one-tap choice as a typed address.
  const ensOpponent = useMemo<Opponent | null>(() => {
    if (typedEns.status !== 'found' || sameAddress(typedEns.address, getCurrentUserId()))
      return null;
    return { wallet: typedEns.address, username: typedEns.name };
  }, [typedEns]);
  const candidate = typedOpponent ?? ensOpponent;
  const lookAlike = useMemo(
    () => findLookAlike(ensOpponent?.wallet ?? addressInput, knownAthletes),
    [ensOpponent, addressInput, knownAthletes]
  );

  const filteredOpponents = useMemo(() => {
    if (!opponents) return opponents;
    const q = opponentQuery.trim().toLowerCase();
    if (!q) return opponents;
    return opponents.filter((o) => o.username.toLowerCase().includes(q));
  }, [opponents, opponentQuery]);

  const validation = useMemo(
    () =>
      validateChallenge({
        opponent: selectedOpponent?.wallet ?? null,
        distanceInput: targetKm,
        metersPerUnit,
        stakeInput: stakeEth,
        balanceWei,
      }),
    [selectedOpponent, targetKm, metersPerUnit, stakeEth, balanceWei]
  );

  // The verification flag comes with the registered list; someone not on it has no profile to verify.
  const opponentVerified = useMemo(() => {
    if (!selectedOpponent || opponents === null) return null;
    const listed = opponents.find((o) => sameAddress(o.wallet, selectedOpponent.wallet));
    if (!listed) return false;
    return listed.isVerified ?? null;
  }, [selectedOpponent, opponents]);

  const alerts = useMemo(() => {
    if (!selectedOpponent || !validation.ok) return [];
    return stakeAlerts({
      me: getCurrentUserId(),
      opponent: selectedOpponent.wallet,
      opponentVerified,
      stakeWei: validation.stakeWei,
      balanceWei,
      durationSeconds: durationDays * DAY_SECONDS,
      hasOpenChallengeWithOpponent: (history ?? []).some(
        (c) =>
          c.status === services.challenge.ChallengeStatus.Open &&
          sameAddress(c.challenger, getCurrentUserId()) &&
          sameAddress(c.opponent, selectedOpponent.wallet)
      ),
    });
  }, [selectedOpponent, validation, opponentVerified, balanceWei, durationDays, history]);

  // A second tap on Send while the first is in flight must not send a second stake.
  const sending = useRef(false);
  // Whether the athlete has ticked "I understand" for the alerts now showing.
  const [understood, setUnderstood] = useState(false);
  const closeConfirm = () => {
    setConfirmOpen(false);
    setUnderstood(false);
  };

  const send = async () => {
    if (sending.current) return;
    if (!selectedOpponent || !validation.ok) return;
    if (!canConfirmStake(alerts, understood)) return;
    sending.current = true;
    closeConfirm();
    haptics.impactMedium();
    setIsSubmitting(true);
    try {
      const result = await run(
        (wallet) =>
          services.challenge.createChallenge(wallet, {
            opponent: selectedOpponent.wallet as `0x${string}`,
            activityType,
            targetMetric: validation.targetMeters,
            durationSeconds: durationDays * 24 * 60 * 60,
            stakeWei: validation.stakeWei,
          }),
        { pending: 'Sending challenge...', success: 'Challenge sent' }
      );
      if (!result?.confirmed) return;
      allowLeave();
      router.replace({
        pathname: '/challenges/[id]',
        params: { id: result.challengeId.toString() },
      });
    } finally {
      sending.current = false;
      setIsSubmitting(false);
    }
  };

  // A refused form points at the field to fix instead of leaving a dead button.
  const rejectSubmit = (field: 'opponent' | 'distance' | 'stake') => {
    if (field === 'opponent') opponentShake.shake();
    else if (field === 'stake') stakeShake.shake();
    else haptics.error();
  };

  // Real money leaves the wallet: show exactly what is being committed first.
  const handleSubmit = () => {
    if (!validation.ok) {
      rejectSubmit(validation.field);
      return;
    }
    if (!selectedOpponent) return;
    haptics.impactMedium();
    setConfirmOpen(true);
  };

  const confirmSummary = () => {
    if (!selectedOpponent || !validation.ok) return '';
    const name = selectedOpponentEnsName || selectedOpponent.username;
    return (
      `You put up ${formatEther(validation.stakeWei)} ETH. ${opponentLabel(name, selectedOpponent.wallet)} must match it to accept. ` +
      `Whoever covers more ${getSportLabel(activityType).toLowerCase()} distance within ${durationDays} days wins both stakes. ` +
      `Target: ${formatDistance(validation.targetMeters, unitSystem)}.`
    );
  };

  const canSubmit = !isSubmitting;

  const renderOpponentPicker = () => {
    if (opponentsFailed) {
      return (
        <ThemedView style={{ gap: Spacing.one }}>
          <ThemedText type="small" themeColor="textSecondary">
            Couldn't load people to challenge. Check your connection.
          </ThemedText>
          <Tappable onPress={loadOpponents} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              Retry
            </ThemedText>
          </Tappable>
        </ThemedView>
      );
    }
    if (opponents === null) {
      return <ActivityIndicator />;
    }
    if (opponents.length === 0) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Nobody else has joined Stryde yet. Invite a friend, then challenge them here.
        </ThemedText>
      );
    }
    return (
      <>
        {opponents.length > 5 && (
          <SearchBar
            value={opponentQuery}
            onChangeText={setOpponentQuery}
            placeholder="Search by username..."
            style={styles.oppSearchBar}
          />
        )}
        {filteredOpponents && filteredOpponents.length === 0 ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.two }}>
            No users match "{opponentQuery}".
          </ThemedText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.oppRow}
            keyboardShouldPersistTaps="handled"
          >
            {(filteredOpponents ?? []).map((o) => {
              const isSelected = selectedOpponent?.wallet === o.wallet;
              return (
                <Tappable
                  key={o.wallet}
                  style={[
                    styles.oppChip,
                    {
                      backgroundColor: isSelected
                        ? theme.brand.primaryTint
                        : theme.backgroundElement,
                      borderColor: isSelected ? theme.brand.primary : theme.border,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.selection();
                    setSelectedOpponent(o);
                  }}
                >
                  <View style={[styles.oppAvatar, { backgroundColor: theme.brand.primary }]}>
                    <ThemedText type="caption" style={{ color: Brand.white, fontWeight: '700' }}>
                      {getInitials(o.username)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" numberOfLines={1}>
                    {isSelected ? selectedOpponentEnsName || o.username : o.username}
                  </ThemedText>
                  {isSelected && selectedNameConfirmed ? <ConfirmedMark /> : null}
                </Tappable>
              );
            })}
          </ScrollView>
        )}
      </>
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <Tappable
            onPress={goBack}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">New Challenge</ThemedText>
          <View style={styles.headerBtn} />
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.field, opponentShake.style]}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Challenge who?
            </ThemedText>
            {renderOpponentPicker()}
            {opponents !== null || opponentsFailed ? (
              <>
                <TextField
                  value={addressInput}
                  onChangeText={setAddressInput}
                  placeholder="Or paste an ID or name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Address or name to challenge"
                />
                {candidate ? (
                  <Tappable
                    onPress={() => {
                      haptics.selection();
                      setSelectedOpponent(candidate);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Challenge ${candidate.username}`}
                    style={[
                      styles.oppChip,
                      {
                        backgroundColor:
                          selectedOpponent?.wallet === candidate.wallet
                            ? theme.brand.primaryTint
                            : theme.backgroundElement,
                        borderColor:
                          selectedOpponent?.wallet === candidate.wallet
                            ? theme.brand.primary
                            : theme.border,
                      },
                    ]}
                  >
                    <Ionicons name="wallet-outline" size={16} color={theme.textSecondary} />
                    <ThemedText type="small">{candidate.username}</ThemedText>
                    {typedEns.status === 'found' &&
                    typedEns.verified &&
                    candidate === ensOpponent ? (
                      <ConfirmedMark />
                    ) : null}
                  </Tappable>
                ) : null}
              </>
            ) : null}
            {typedEns.status === 'rejected' ? (
              <Notice severity="danger">{ENS_PROBLEM_COPY[typedEns.problem]}</Notice>
            ) : null}
            {typedEns.status === 'resolving' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Looking up that name...
              </ThemedText>
            ) : null}
            {typedEns.status === 'unknown' ? (
              <ThemedText type="small" themeColor="textSecondary">
                No one is using that name.
              </ThemedText>
            ) : null}
            {typedEns.status === 'found' && !typedEns.verified ? (
              <Notice severity="info">
                This name could not be confirmed in both directions. Check the address before you
                send.
              </Notice>
            ) : null}
            {lookAlike ? <LookAlikeNotice lookAlike={lookAlike} /> : null}
            {selectedOpponent &&
            history !== null &&
            isNewCounterparty(selectedOpponent.wallet, pastCounterparties) ? (
              <Notice severity="info">You have not challenged this person before.</Notice>
            ) : null}
          </Animated.View>

          <SportField value={activityType} onChange={setActivityType} />

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {`Target distance (${distanceUnitLabel(unitSystem)})`}
            </ThemedText>
            <TextField value={targetKm} onChangeText={setTargetKm} keyboardType="decimal-pad" />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Duration
            </ThemedText>
            <ThemedView style={styles.pillRow}>
              {DAYS_OPTIONS.map((d) => {
                const isSelected = durationDays === d;
                return (
                  <Tappable
                    key={d}
                    style={[
                      styles.dayPill,
                      {
                        backgroundColor: isSelected
                          ? theme.brand.primaryTint
                          : theme.backgroundElement,
                        borderColor: isSelected ? theme.brand.primary : theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      haptics.selection();
                      setDurationDays(d);
                    }}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: isSelected ? theme.brand.primary : theme.text }}
                    >
                      {d}d
                    </ThemedText>
                  </Tappable>
                );
              })}
            </ThemedView>
          </ThemedView>

          <Animated.View style={[styles.field, stakeShake.style]}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Stake (ETH, each side)
            </ThemedText>
            <TextField value={stakeEth} onChangeText={setStakeEth} keyboardType="decimal-pad" />
            {balanceWei !== null && (
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: Spacing.one }}
              >
                {`Balance: ${formatEthAmount(balanceWei)}`}
                {address ? ` · ${shortAddress(address)}` : ''}
              </ThemedText>
            )}
          </Animated.View>

          <AppButton onPress={handleSubmit} disabled={!canSubmit} style={styles.submitBtn}>
            {isSubmitting ? 'Creating...' : 'Send Challenge'}
          </AppButton>
          {!validation.ok && !isSubmitting && (
            <ThemedText
              type="small"
              style={{
                color: validation.reason.startsWith('Not enough')
                  ? theme.brand.danger
                  : theme.textSecondary,
                textAlign: 'center',
              }}
            >
              {validation.reason}
            </ThemedText>
          )}

          <View style={{ height: Spacing.five }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <StakeConfirm
        visible={confirmOpen}
        title="Send challenge?"
        summary={confirmSummary()}
        alerts={alerts}
        confirmLabel="Send"
        onConfirm={send}
        understood={understood}
        onUnderstoodChange={setUnderstood}
        onCancel={closeConfirm}
      />
    </ThemedView>
  );
}

/** Shown beside a name that points at the address and back. */
function ConfirmedMark() {
  const theme = useTheme();
  return (
    <Ionicons
      name="checkmark-circle"
      size={16}
      color={theme.brand.verified}
      accessibilityLabel="Name confirmed in both directions"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 0 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  oppSearchBar: {
    marginBottom: Spacing.two,
  },
  oppRow: {
    flexGrow: 0,
  },
  oppChip: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.two,
    minWidth: 76,
  },
  oppAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dayPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  submitBtn: {
    marginTop: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
