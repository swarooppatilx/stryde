import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseEther } from 'viem';

import { AppButton } from '@/components/button';
import { SportTypePicker } from '@/components/sport-type-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV, getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import type { ActivityType } from '@/types';
import { getInitials } from '@/utils/format';
import { haptics } from '@/utils/haptics';

interface Opponent {
  wallet: string;
  username: string;
}

const DAYS_OPTIONS = [1, 3, 7, 14, 30];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);

  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [targetKm, setTargetKm] = useState('5');
  const [durationDays, setDurationDays] = useState(7);
  const [stakeEth, setStakeEth] = useState('0.01');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    services.profile
      .getRegisteredUsers()
      .then((users) => {
        if (cancelled) return;
        const currentUserId = getCurrentUserId();
        setOpponents(
          users
            .filter((u) => u.wallet.toLowerCase() !== currentUserId.toLowerCase())
            .map((u) => ({ wallet: u.wallet, username: u.username }))
        );
      })
      .catch(() => {
        if (!cancelled) setOpponents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!wallet || !address || !selectedOpponent) return;
    const km = Number.parseFloat(targetKm);
    if (!Number.isFinite(km) || km <= 0) {
      Alert.alert('Invalid distance', 'Enter a target distance greater than 0.');
      return;
    }
    let stakeWei: bigint;
    try {
      stakeWei = parseEther(stakeEth || '0');
    } catch {
      Alert.alert('Invalid stake', 'Enter a valid ETH amount.');
      return;
    }
    if (stakeWei <= 0n) {
      Alert.alert('Invalid stake', 'Stake must be greater than 0.');
      return;
    }

    haptics.success();
    setIsSubmitting(true);
    try {
      const { challengeId, confirmed } = await services.challenge.createChallenge(wallet, {
        opponent: selectedOpponent.wallet as `0x${string}`,
        activityType,
        targetMetric: Math.round(km * 1000),
        durationSeconds: durationDays * 24 * 60 * 60,
        stakeWei,
      });
      if (!confirmed) {
        Alert.alert('Challenge failed', "The transaction didn't confirm. Please try again.");
        return;
      }
      router.replace({ pathname: '/challenge-detail', params: { id: challengeId.toString() } });
    } catch (err) {
      console.warn('[CreateChallenge] createChallenge failed', err);
      Alert.alert('Challenge failed', 'Could not create the challenge. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !!selectedOpponent && !isSubmitting;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="sectionTitle">New Challenge</ThemedText>
          <View style={styles.headerBtn} />
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Opponent */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Challenge who?
            </ThemedText>
            {opponents === null ? (
              <ActivityIndicator />
            ) : opponents.length === 0 ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                No other registered users to challenge yet.
              </ThemedText>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.oppRow}>
                {opponents.map((o) => {
                  const isSelected = selectedOpponent?.wallet === o.wallet;
                  return (
                    <TouchableOpacity
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
                        <ThemedText type="caption" style={{ color: '#fff', fontWeight: '700' }}>
                          {getInitials(o.username)}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" numberOfLines={1}>
                        {o.username}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </ThemedView>

          {/* Sport */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Sport
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.sportSelector,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                setShowSportPicker(!showSportPicker);
              }}
            >
              <ThemedText type="smallBold">
                {activityType.charAt(0).toUpperCase() + activityType.slice(1)}
              </ThemedText>
              <Ionicons
                name={showSportPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            {showSportPicker && (
              <SportTypePicker
                selected={activityType}
                onSelect={(type) => {
                  setActivityType(type);
                  setShowSportPicker(false);
                }}
              />
            )}
          </ThemedView>

          {/* Target distance */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Target distance (km)
            </ThemedText>
            <TextInputField value={targetKm} onChangeText={setTargetKm} theme={theme} />
          </ThemedView>

          {/* Duration */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Duration
            </ThemedText>
            <ThemedView style={styles.pillRow}>
              {DAYS_OPTIONS.map((d) => {
                const isSelected = durationDays === d;
                return (
                  <TouchableOpacity
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
                  </TouchableOpacity>
                );
              })}
            </ThemedView>
          </ThemedView>

          {/* Stake */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Stake (ETH, each side)
            </ThemedText>
            <TextInputField value={stakeEth} onChangeText={setStakeEth} theme={theme} />
          </ThemedView>

          <AppButton onPress={handleSubmit} disabled={!canSubmit} style={styles.submitBtn}>
            {isSubmitting ? 'Creating...' : 'Send Challenge'}
          </AppButton>

          <View style={{ height: Spacing.five }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

// Simple inline text input to avoid Ant Design dependency issues
import { TextInput } from 'react-native';

function TextInputField({
  value,
  onChangeText,
  theme,
}: {
  value: string;
  onChangeText: (t: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={[
        styles.input,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholderTextColor={theme.textSecondary}
        style={{ flex: 1, color: theme.text, fontSize: 16, padding: 0 }}
      />
    </View>
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    minHeight: 44,
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
