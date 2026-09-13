import { List, Switch } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { services } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { useShallow } from 'zustand/shallow';

import { ListIcon } from '@/components/list-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTransactor } from '@/hooks/useTransactor';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useProfileStore } from '@/stores/profileStore';
import { ACCURACY_MODE_CONFIG, ACCURACY_MODES, useSettingsStore } from '@/stores/settingsStore';
import { formatDistance, formatDuration } from '@/utils/format';

const WEEKLY_GOAL_STEPS = {
  distance: { step: 1000, min: 0, max: 100000 },
  activities: { step: 1, min: 0, max: 50 },
  time: { step: 300000, min: 0, max: 36000000 },
} as const;

interface StepperProps {
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  format: (value: number) => string;
  accessibilityLabel: string;
}

function Stepper({ value, step, min, max, onChange, format, accessibilityLabel }: StepperProps) {
  const theme = useTheme();
  const decreasedDisabled = value <= min;
  const increasedDisabled = value >= max;

  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - step))}
        disabled={decreasedDisabled}
        hitSlop={10}
        style={[styles.stepperButton, decreasedDisabled && styles.stepperButtonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: decreasedDisabled }}
        accessibilityLabel={`Decrease ${accessibilityLabel}`}
      >
        <Ionicons name="remove" size={18} color={theme.brand.primary} />
      </TouchableOpacity>
      <ThemedText type="smallBold" style={styles.stepperValue}>
        {format(value)}
      </ThemedText>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + step))}
        disabled={increasedDisabled}
        hitSlop={10}
        style={[styles.stepperButton, increasedDisabled && styles.stepperButtonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: increasedDisabled }}
        accessibilityLabel={`Increase ${accessibilityLabel}`}
      >
        <Ionicons name="add" size={18} color={theme.brand.primary} />
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const themePreference = useProfileStore((s) => s.settings.theme);
  const units = useProfileStore((s) => s.settings.units);
  const weeklyGoalDistance = useProfileStore((s) => s.settings.weeklyGoalDistance);
  const weeklyGoalActivities = useProfileStore((s) => s.settings.weeklyGoalActivities);
  const weeklyGoalTime = useProfileStore((s) => s.settings.weeklyGoalTime);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const {
    useGyroscopeAssist,
    sensorUpdateRate,
    autoPause,
    accuracyMode,
    setGyroscopeAssist,
    setSensorUpdateRate,
    setAutoPause,
    setAccuracyMode,
  } = useSettingsStore(
    useShallow((s) => ({
      useGyroscopeAssist: s.useGyroscopeAssist,
      sensorUpdateRate: s.sensorUpdateRate,
      autoPause: s.autoPause,
      accuracyMode: s.accuracyMode,
      setGyroscopeAssist: s.setGyroscopeAssist,
      setSensorUpdateRate: s.setSensorUpdateRate,
      setAutoPause: s.setAutoPause,
      setAccuracyMode: s.setAccuracyMode,
    }))
  );
  const { user } = usePrivy();
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();

  const emailAccount = user?.linked_accounts?.find((a) => a.type === 'email');
  const email = emailAccount && 'address' in emailAccount ? emailAccount.address : null;
  // The on-chain identity address (from useViemWallet), not the Privy embedded
  // auth wallet — in local dev mode these differ (see AGENTS.md).
  const walletAddress = address;
  const networkName = services.client.getActiveConfig().chain.name;

  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!walletAddress) return;
      let cancelled = false;
      services.client
        .getBalance(walletAddress)
        .then((wei) => {
          if (!cancelled) setBalanceWei(wei);
        })
        .catch(() => {
          if (!cancelled) setBalanceWei(null);
        });
      return () => {
        cancelled = true;
      };
    }, [walletAddress])
  );

  // Dev-only: proves the smart-account/paymaster wiring actually sponsors
  // gas, without needing any of this app's contracts deployed. Remove once
  // the Privy track submission is done.
  const handleTestGaslessTx = async () => {
    if (!wallet || !address) return;
    await transact(
      async () => {
        const hash = await wallet.sendTransaction({
          to: address,
          value: 0n,
        } as Parameters<typeof wallet.sendTransaction>[0]);
        const client = services.client.getPublicClient();
        const receipt = await client.waitForTransactionReceipt({ hash });
        return { confirmed: receipt.status === 'success', txHash: hash };
      },
      { pending: 'Sending gasless test tx...', success: 'Gasless tx confirmed' }
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Header ── */}
          <ThemedView style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="subtitle">Settings</ThemedText>
            <View style={styles.headerSpacer} />
          </ThemedView>

          {/* ── Appearance ── */}
          <ThemedText
            type="eyebrow"
            style={{ color: theme.textSecondary }}
            accessibilityRole="header"
          >
            APPEARANCE
          </ThemedText>
          <View style={styles.toggleRow}>
            {(['system', 'light', 'dark'] as const).map((pref) => {
              const active = themePreference === pref;
              return (
                <TouchableOpacity
                  key={pref}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.toggleOption,
                    { backgroundColor: active ? theme.brand.primary : theme.backgroundElement },
                  ]}
                  onPress={() => {
                    updateSettings({ theme: pref });
                  }}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: active ? Brand.white : theme.text,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {pref === 'system' ? 'Auto' : pref === 'light' ? 'Light' : 'Dark'}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Units ── */}
          <ThemedText
            type="eyebrow"
            style={{ color: theme.textSecondary }}
            accessibilityRole="header"
          >
            UNITS
          </ThemedText>
          <View style={styles.toggleRow}>
            {(['metric', 'imperial'] as const).map((unit) => {
              const active = units === unit;
              return (
                <TouchableOpacity
                  key={unit}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.toggleOption,
                    { backgroundColor: active ? theme.brand.primary : theme.backgroundElement },
                  ]}
                  onPress={() => {
                    updateSettings({ units: unit });
                  }}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: active ? Brand.white : theme.text,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {unit === 'metric' ? 'Metric (km)' : 'Imperial (mi)'}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Weekly Goals ── */}
          <ThemedText
            type="eyebrow"
            style={{ color: theme.textSecondary }}
            accessibilityRole="header"
          >
            WEEKLY GOALS
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="resize-outline" />}
              extra={
                <Stepper
                  value={weeklyGoalDistance}
                  step={WEEKLY_GOAL_STEPS.distance.step}
                  min={WEEKLY_GOAL_STEPS.distance.min}
                  max={WEEKLY_GOAL_STEPS.distance.max}
                  format={formatDistance}
                  accessibilityLabel="distance goal"
                  onChange={(next) => updateSettings({ weeklyGoalDistance: next })}
                />
              }
            >
              Distance
            </List.Item>
            <List.Item
              thumb={<ListIcon name="footsteps-outline" />}
              extra={
                <Stepper
                  value={weeklyGoalActivities}
                  step={WEEKLY_GOAL_STEPS.activities.step}
                  min={WEEKLY_GOAL_STEPS.activities.min}
                  max={WEEKLY_GOAL_STEPS.activities.max}
                  format={(value) => String(value)}
                  accessibilityLabel="activities goal"
                  onChange={(next) => updateSettings({ weeklyGoalActivities: next })}
                />
              }
            >
              Activities
            </List.Item>
            <List.Item
              thumb={<ListIcon name="time-outline" />}
              extra={
                <Stepper
                  value={weeklyGoalTime}
                  step={WEEKLY_GOAL_STEPS.time.step}
                  min={WEEKLY_GOAL_STEPS.time.min}
                  max={WEEKLY_GOAL_STEPS.time.max}
                  format={formatDuration}
                  accessibilityLabel="time goal"
                  onChange={(next) => updateSettings({ weeklyGoalTime: next })}
                />
              }
            >
              Time
            </List.Item>
          </List>

          {/* ── Tracking ── */}
          <ThemedText
            type="eyebrow"
            style={{ color: theme.textSecondary }}
            accessibilityRole="header"
          >
            TRACKING
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="hardware-chip-outline" />}
              extra={
                <Switch
                  checked={useGyroscopeAssist}
                  onChange={setGyroscopeAssist}
                  color={theme.brand.primary}
                />
              }
            >
              Gyroscope Assist
            </List.Item>
            <List.Item
              thumb={<ListIcon name="pause-circle-outline" />}
              extra={
                <Switch checked={autoPause} onChange={setAutoPause} color={theme.brand.primary} />
              }
            >
              Auto-pause
            </List.Item>
            <List.Item
              thumb={<ListIcon name="speedometer-outline" />}
              extra={
                <View style={styles.toggleRow}>
                  {ACCURACY_MODES.map((mode) => {
                    const active = accuracyMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`GPS accuracy: ${ACCURACY_MODE_CONFIG[mode].label}`}
                        style={[
                          styles.toggleOption,
                          {
                            backgroundColor: active ? theme.brand.primary : theme.backgroundElement,
                          },
                        ]}
                        onPress={() => setAccuracyMode(mode)}
                      >
                        <ThemedText
                          type="caption"
                          style={{
                            color: active ? Brand.white : theme.text,
                            fontWeight: active ? '700' : '500',
                          }}
                        >
                          {ACCURACY_MODE_CONFIG[mode].label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              }
            >
              GPS Accuracy
            </List.Item>
          </List>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: -Spacing.one }}
          >
            {ACCURACY_MODE_CONFIG[accuracyMode].caption}
          </ThemedText>
          {useGyroscopeAssist ? (
            <List>
              <List.Item
                thumb={<ListIcon name="speedometer-outline" />}
                extra={
                  <View style={styles.toggleRow}>
                    {([10, 50] as const).map((rate) => {
                      const active = sensorUpdateRate === rate;
                      return (
                        <TouchableOpacity
                          key={rate}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.toggleOption,
                            {
                              backgroundColor: active
                                ? theme.brand.primary
                                : theme.backgroundElement,
                            },
                          ]}
                          onPress={() => setSensorUpdateRate(rate)}
                        >
                          <ThemedText
                            type="caption"
                            style={{
                              color: active ? Brand.white : theme.text,
                              fontWeight: active ? '700' : '500',
                            }}
                          >
                            {rate}Hz
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                }
              >
                Sensor Rate
              </List.Item>
            </List>
          ) : null}

          {/* ── Account ── */}
          <ThemedText
            type="eyebrow"
            style={{ color: theme.textSecondary }}
            accessibilityRole="header"
          >
            ACCOUNT
          </ThemedText>
          {email ? (
            <List>
              <List.Item
                key="email"
                thumb={<ListIcon name="mail-outline" />}
                extra={
                  <ThemedText
                    type="caption"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.emailValue}
                  >
                    {email}
                  </ThemedText>
                }
              >
                Email
              </List.Item>
            </List>
          ) : null}
          {walletAddress ? (
            <List>
              <List.Item
                key="wallet"
                thumb={<ListIcon name="wallet-outline" />}
                extra={`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
              >
                Wallet
              </List.Item>
              <List.Item
                key="network"
                thumb={<ListIcon name="globe-outline" />}
                extra={networkName}
              >
                Network
              </List.Item>
              <List.Item
                key="balance"
                thumb={<ListIcon name="cash-outline" />}
                extra={
                  balanceWei !== null ? `${Number(formatEther(balanceWei)).toFixed(4)} ETH` : '—'
                }
              >
                Balance
              </List.Item>
            </List>
          ) : null}
          {__DEV__ && ENV.USE_SMART_WALLET && (
            <List>
              <List.Item
                key="test-gasless"
                thumb={<ListIcon name="flash-outline" />}
                onPress={handleTestGaslessTx}
                arrow="horizontal"
              >
                Send test gasless transaction
              </List.Item>
            </List>
          )}
          <List>
            <List.Item
              key="version"
              thumb={<ListIcon name="information-circle-outline" />}
              extra="1.0.0"
            >
              Version
            </List.Item>
          </List>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40 },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperValue: {
    minWidth: 64,
    textAlign: 'center',
  },
  emailValue: {
    maxWidth: 160,
  },
});
