import { List } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';
import { AppSwitch } from '@/components/app-switch';
import { AppleWatchSettings } from '@/components/apple-watch-settings';
import { Segmented } from '@/components/form-controls';
import { ListIcon } from '@/components/list-icon';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LOW_POWER_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import {
  ACCURACY_MODE_CONFIG,
  ACCURACY_MODES,
  COUNTDOWN_OPTIONS,
  useSettingsStore,
} from '@/stores/settingsStore';
import { AUDIO_CUE_INTERVALS, audioCueIntervalLabel } from '@/utils/audioCue';

export default function RecordingSettingsScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const s = useSettingsStore(
    useShallow((state) => ({
      autoPause: state.autoPause,
      autoPauseOnFoot: state.autoPauseOnFoot,
      audioCueInterval: state.audioCueInterval,
      announceActions: state.announceActions,
      keepScreenOn: state.keepScreenOn,
      countdownSeconds: state.countdownSeconds,
      accuracyMode: state.accuracyMode,
      adjustGpsInBatterySaver: state.adjustGpsInBatterySaver,
      useGyroscopeAssist: state.useGyroscopeAssist,
      setAutoPause: state.setAutoPause,
      setAutoPauseOnFoot: state.setAutoPauseOnFoot,
      setAudioCueInterval: state.setAudioCueInterval,
      setAnnounceActions: state.setAnnounceActions,
      setKeepScreenOn: state.setKeepScreenOn,
      setCountdownSeconds: state.setCountdownSeconds,
      setAccuracyMode: state.setAccuracyMode,
      setAdjustGpsInBatterySaver: state.setAdjustGpsInBatterySaver,
      setGyroscopeAssist: state.setGyroscopeAssist,
    }))
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.header}>
            <Tappable
              onPress={goBack}
              hitSlop={8}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Tappable>
            <ThemedText type="headline">Recording</ThemedText>
            <View style={styles.headerSpacer} />
          </ThemedView>

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            AUTO-PAUSE
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="walk-outline" />}
              extra={
                <AppSwitch
                  checked={s.autoPauseOnFoot}
                  onChange={s.setAutoPauseOnFoot}
                  label="Auto-pause runs and walks"
                />
              }
            >
              Runs and walks
              <List.Item.Brief>
                Pauses when you stop moving, using the phone's motion sensor. A phone in your hand
                reads steps less reliably.
              </List.Item.Brief>
            </List.Item>
            <List.Item
              thumb={<ListIcon name="bicycle-outline" />}
              extra={
                <AppSwitch
                  checked={s.autoPause}
                  onChange={s.setAutoPause}
                  label="Auto-pause rides"
                />
              }
            >
              Rides
              <List.Item.Brief>Rides and other sports pause from your GPS speed.</List.Item.Brief>
            </List.Item>
          </List>

          <AppleWatchSettings />

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            AUDIO CUES
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="megaphone-outline" />}
              extra={
                <AppSwitch
                  checked={s.announceActions}
                  onChange={s.setAnnounceActions}
                  label="Announce start, pause and stop"
                />
              }
            >
              Announce start, pause and stop
            </List.Item>
          </List>
          <Segmented
            label="Distance announcements"
            showLabel
            value={s.audioCueInterval}
            options={AUDIO_CUE_INTERVALS.map((interval) => ({
              value: interval,
              label: audioCueIntervalLabel(interval, unitSystem),
            }))}
            onChange={s.setAudioCueInterval}
          />

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            SCREEN
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="sunny-outline" />}
              extra={
                <AppSwitch
                  checked={s.keepScreenOn}
                  onChange={s.setKeepScreenOn}
                  label="Keep screen on while recording"
                />
              }
            >
              Keep screen on while recording
              <List.Item.Brief>Uses more battery.</List.Item.Brief>
            </List.Item>
          </List>
          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            COUNTDOWN
          </ThemedText>
          <Segmented
            label="Countdown before recording starts"
            value={s.countdownSeconds}
            options={COUNTDOWN_OPTIONS.map((seconds) => ({
              value: seconds,
              label: seconds === 0 ? 'Off' : `${seconds} s`,
            }))}
            onChange={s.setCountdownSeconds}
          />

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            ADVANCED
          </ThemedText>
          <Segmented
            label="GPS accuracy"
            showLabel
            value={s.accuracyMode}
            options={ACCURACY_MODES.map((mode) => ({
              value: mode,
              label: ACCURACY_MODE_CONFIG[mode].label,
            }))}
            onChange={s.setAccuracyMode}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {ACCURACY_MODE_CONFIG[s.accuracyMode].caption}
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="battery-half-outline" />}
              extra={
                <AppSwitch
                  checked={s.adjustGpsInBatterySaver}
                  onChange={s.setAdjustGpsInBatterySaver}
                  label={LOW_POWER_COPY.settingLabel}
                />
              }
            >
              {LOW_POWER_COPY.settingLabel}
              <List.Item.Brief>{LOW_POWER_COPY.settingBrief}</List.Item.Brief>
            </List.Item>
            <List.Item
              thumb={<ListIcon name="hardware-chip-outline" />}
              extra={
                <AppSwitch
                  checked={s.useGyroscopeAssist}
                  onChange={s.setGyroscopeAssist}
                  label="Gyroscope assist"
                />
              }
            >
              Gyroscope assist
              <List.Item.Brief>Fills gaps in the route when the GPS signal drops.</List.Item.Brief>
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
});
