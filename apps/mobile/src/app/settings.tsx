import { List, Switch } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import { ListIcon } from '@/components/list-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
  const settings = useProfileStore((s) => s.settings);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const { useGyroscopeAssist, sensorUpdateRate, setGyroscopeAssist, setSensorUpdateRate } =
    useSettingsStore(
      useShallow((s) => ({
        useGyroscopeAssist: s.useGyroscopeAssist,
        sensorUpdateRate: s.sensorUpdateRate,
        setGyroscopeAssist: s.setGyroscopeAssist,
        setSensorUpdateRate: s.setSensorUpdateRate,
      }))
    );
  const { user } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();

  const emailAccount = user?.linked_accounts?.find((a) => a.type === 'email');
  const email = emailAccount && 'address' in emailAccount ? emailAccount.address : null;
  const walletAddress = wallets?.[0]?.address;

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
              const active = settings.theme === pref;
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
              const active = settings.units === unit;
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
                  value={settings.weeklyGoalDistance}
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
                  value={settings.weeklyGoalActivities}
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
                  value={settings.weeklyGoalTime}
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
          </List>
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
            </List>
          ) : null}
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
