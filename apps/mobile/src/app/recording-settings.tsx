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
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { useT } from '@/i18n';
import { ACCURACY_MODES, COUNTDOWN_OPTIONS, useSettingsStore } from '@/stores/settingsStore';
import { AUDIO_CUE_INTERVALS, audioCueIntervalLabel } from '@/utils/audioCue';

const ACCURACY_TEXT = {
  best: { label: 'accuracy.best', caption: 'recordingSettings.accuracyBestCaption' },
  balanced: { label: 'accuracy.balanced', caption: 'recordingSettings.accuracyBalancedCaption' },
  power: { label: 'accuracy.lowPower', caption: 'recordingSettings.accuracyPowerCaption' },
} as const;

export default function RecordingSettingsScreen() {
  const t = useT();
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
              accessibilityLabel={t('common.goBack')}
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Tappable>
            <ThemedText type="headline">{t('recordingSettings.title')}</ThemedText>
            <View style={styles.headerSpacer} />
          </ThemedView>

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            {t('recordingSettings.headingAutoPause')}
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="walk-outline" />}
              extra={
                <AppSwitch
                  checked={s.autoPauseOnFoot}
                  onChange={s.setAutoPauseOnFoot}
                  label={t('recordingSettings.runsWalksLabel')}
                />
              }
            >
              {t('recordingSettings.runsWalks')}
              <List.Item.Brief>{t('recordingSettings.runsWalksHint')}</List.Item.Brief>
            </List.Item>
            <List.Item
              thumb={<ListIcon name="bicycle-outline" />}
              extra={
                <AppSwitch
                  checked={s.autoPause}
                  onChange={s.setAutoPause}
                  label={t('recordingSettings.ridesLabel')}
                />
              }
            >
              {t('recordingSettings.rides')}
              <List.Item.Brief>{t('recordingSettings.ridesHint')}</List.Item.Brief>
            </List.Item>
          </List>

          <AppleWatchSettings />

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            {t('recordingSettings.headingAudio')}
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="megaphone-outline" />}
              extra={
                <AppSwitch
                  checked={s.announceActions}
                  onChange={s.setAnnounceActions}
                  label={t('recordingSettings.announce')}
                />
              }
            >
              {t('recordingSettings.announce')}
            </List.Item>
          </List>
          <Segmented
            label={t('recordingSettings.distanceAnnouncements')}
            showLabel
            value={s.audioCueInterval}
            options={AUDIO_CUE_INTERVALS.map((interval) => ({
              value: interval,
              label: audioCueIntervalLabel(interval, unitSystem, t),
            }))}
            onChange={s.setAudioCueInterval}
          />

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            {t('recordingSettings.headingScreen')}
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="sunny-outline" />}
              extra={
                <AppSwitch
                  checked={s.keepScreenOn}
                  onChange={s.setKeepScreenOn}
                  label={t('recordingSettings.keepScreenOn')}
                />
              }
            >
              {t('recordingSettings.keepScreenOn')}
              <List.Item.Brief>{t('recordingSettings.keepScreenOnHint')}</List.Item.Brief>
            </List.Item>
          </List>
          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            {t('recordingSettings.headingCountdown')}
          </ThemedText>
          <Segmented
            label={t('recordingSettings.countdownLabel')}
            value={s.countdownSeconds}
            options={COUNTDOWN_OPTIONS.map((seconds) => ({
              value: seconds,
              label: seconds === 0 ? t('common.off') : t('recordingSettings.seconds', { seconds }),
            }))}
            onChange={s.setCountdownSeconds}
          />

          <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
            {t('recordingSettings.headingAdvanced')}
          </ThemedText>
          <Segmented
            label={t('recordingSettings.gpsAccuracy')}
            showLabel
            value={s.accuracyMode}
            options={ACCURACY_MODES.map((mode) => ({
              value: mode,
              label: t(ACCURACY_TEXT[mode].label),
            }))}
            onChange={s.setAccuracyMode}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {t(ACCURACY_TEXT[s.accuracyMode].caption)}
          </ThemedText>
          <List>
            <List.Item
              thumb={<ListIcon name="battery-half-outline" />}
              extra={
                <AppSwitch
                  checked={s.adjustGpsInBatterySaver}
                  onChange={s.setAdjustGpsInBatterySaver}
                  label={t('recordingSettings.lowPowerLabel')}
                />
              }
            >
              {t('recordingSettings.lowPowerLabel')}
              <List.Item.Brief>{t('recordingSettings.lowPowerHint')}</List.Item.Brief>
            </List.Item>
            <List.Item
              thumb={<ListIcon name="hardware-chip-outline" />}
              extra={
                <AppSwitch
                  checked={s.useGyroscopeAssist}
                  onChange={s.setGyroscopeAssist}
                  label={t('recordingSettings.gyro')}
                />
              }
            >
              {t('recordingSettings.gyro')}
              <List.Item.Brief>{t('recordingSettings.gyroHint')}</List.Item.Brief>
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
