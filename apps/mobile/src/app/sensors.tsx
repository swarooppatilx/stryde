import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { Stepper } from '@/components/form-controls';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SENSORS_COPY } from '@/constants/copy';
import { BorderRadius, IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useBleAdapter } from '@/hooks/useBleAdapter';
import { useBleScan } from '@/hooks/useBleScan';
import { useGoBack } from '@/hooks/useGoBack';
import { useNow } from '@/hooks/useNow';
import { useSensorHub } from '@/hooks/useSensorHub';
import { getPlatform } from '@/platform';
import type { BleAdapterState, BleDevice, SensorKind } from '@/platform/ports';
import { sensorHub } from '@/services/sensorHub';
import { type PairedSensor, useSensorStore } from '@/stores/sensorStore';
import {
  groupByKind,
  liveSensors,
  readingText,
  SENSOR_KIND_LABEL,
  SENSOR_KIND_ORDER,
  type SensorLink,
  signalBars,
} from '@/utils/sensorLive';

const KIND_ICON: Record<SensorKind, keyof typeof Ionicons.glyphMap> = {
  heartRate: 'heart-outline',
  power: 'flash-outline',
  speedCadence: 'speedometer-outline',
};

const SIGNAL_TEXT = ['', 'Weak signal', 'Fair signal', 'Good signal', 'Strong signal'] as const;
const WHEEL_STEP_MM = 5;
const WHEEL_MIN_MM = 1000;
const WHEEL_MAX_MM = 2600;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>
  );
}

function AdapterNotice({
  state,
  onAsk,
}: {
  state: Exclude<BleAdapterState, 'ready'>;
  onAsk: () => void;
}) {
  const copy = {
    off: SENSORS_COPY.off,
    unauthorized: SENSORS_COPY.denied,
    unsupported: SENSORS_COPY.unsupported,
  }[state];
  return (
    <Card>
      <ThemedText type="smallBold">{copy.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {copy.body}
      </ThemedText>
      {state === 'unauthorized' && (
        <View style={styles.buttons}>
          <AppButton size="small" fullWidth={false} onPress={onAsk}>
            {SENSORS_COPY.denied.ask}
          </AppButton>
          <AppButton
            size="small"
            fullWidth={false}
            variant="secondary"
            onPress={() => void getPlatform().readiness.openAppSettings()}
          >
            {SENSORS_COPY.denied.openSettings}
          </AppButton>
        </View>
      )}
    </Card>
  );
}

function statusText(link: SensorLink | undefined): string {
  return SENSORS_COPY.status[link?.status ?? 'idle'];
}

function PairedRow({
  sensor,
  link,
  preview,
}: {
  sensor: PairedSensor;
  link: SensorLink | undefined;
  preview: string | null;
}) {
  const theme = useTheme();
  const forget = useSensorStore((s) => s.forget);
  const connected = link?.status === 'connected';
  const busy = link?.status === 'connecting' || link?.status === 'reconnecting';
  const others = useSensorStore((s) =>
    Object.values(s.paired).filter((p): p is PairedSensor => p !== null && p.id === sensor.id)
  );

  const toggle = () => {
    if (connected || busy) void sensorHub.disconnect(sensor.id);
    else void sensorHub.connectPaired(others);
  };
  const remove = () => {
    forget(sensor.kind);
    const stillUsed = others.some((p) => p.kind !== sensor.kind);
    if (!stillUsed) void sensorHub.disconnect(sensor.id);
  };

  return (
    <View style={styles.row}>
      <Ionicons name={KIND_ICON[sensor.kind]} size={IconSize.action} color={theme.textSecondary} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{sensor.name}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {SENSOR_KIND_LABEL[sensor.kind]} · {statusText(link)}
        </ThemedText>
        {connected && (
          <ThemedText type="caption" themeColor="successText" accessibilityLiveRegion="polite">
            {preview ?? SENSORS_COPY.waitingForReading}
          </ThemedText>
        )}
      </View>
      <View style={styles.rowActions}>
        <AppButton size="small" fullWidth={false} variant="secondary" onPress={toggle}>
          {connected || busy ? SENSORS_COPY.disconnect : SENSORS_COPY.connect}
        </AppButton>
        <Tappable
          onPress={remove}
          style={styles.forget}
          accessibilityRole="button"
          accessibilityLabel={`${SENSORS_COPY.forget} ${sensor.name}`}
        >
          <ThemedText type="small" themeColor="dangerText">
            {SENSORS_COPY.forget}
          </ThemedText>
        </Tappable>
      </View>
    </View>
  );
}

function NearbyRow({
  device,
  kind,
  onPick,
}: {
  device: BleDevice;
  kind: SensorKind;
  onPick: () => void;
}) {
  const theme = useTheme();
  const name = device.name ?? `${SENSOR_KIND_LABEL[kind]} sensor`;
  const bars = signalBars(device.rssi);
  return (
    <Tappable
      onPress={onPick}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${SIGNAL_TEXT[bars]}. ${SENSORS_COPY.connect}`}
    >
      <Ionicons name={KIND_ICON[kind]} size={IconSize.action} color={theme.textSecondary} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{name}</ThemedText>
        {bars > 0 && (
          <ThemedText type="caption" themeColor="textSecondary">
            {SIGNAL_TEXT[bars]}
          </ThemedText>
        )}
      </View>
      <ThemedText type="small" themeColor="accentText">
        {SENSORS_COPY.connect}
      </ThemedText>
    </Tappable>
  );
}

export default function SensorsScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const { state, request } = useBleAdapter();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  const { devices, failed } = useBleScan(focused && state === 'ready');
  const hub = useSensorHub();
  const now = useNow(1000);
  const paired = useSensorStore((s) => s.paired);
  const pair = useSensorStore((s) => s.pair);
  const autoConnect = useSensorStore((s) => s.autoConnect);
  const setAutoConnect = useSensorStore((s) => s.setAutoConnect);
  const wheelMm = useSensorStore((s) => s.defaultWheelMm);
  const setWheelMm = useSensorStore((s) => s.setDefaultWheelMm);

  const live = liveSensors(hub.latest, hub.links, now);
  const pairedList = SENSOR_KIND_ORDER.map((kind) => paired[kind]).filter(
    (p): p is PairedSensor => p !== null
  );
  const pairedIds = new Set(pairedList.map((p) => p.id));
  const groups = groupByKind(devices)
    .map((g) => ({ ...g, devices: g.devices.filter((d) => paired[g.kind]?.id !== d.id) }))
    .filter((g) => g.devices.length > 0);

  const choose = (device: BleDevice, kind: SensorKind) => {
    pair(
      kind,
      { id: device.id, name: device.name ?? `${SENSOR_KIND_LABEL[kind]} sensor` },
      Date.now()
    );
    const all = Object.values(useSensorStore.getState().paired).filter(
      (p): p is PairedSensor => p !== null && p.id === device.id
    );
    void sensorHub.connectPaired(all);
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Tappable
              onPress={goBack}
              hitSlop={8}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Tappable>
            <ThemedText type="headline">{SENSORS_COPY.title}</ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {SENSORS_COPY.intro}
          </ThemedText>

          {state !== null && state !== 'ready' && (
            <AdapterNotice state={state} onAsk={() => void request()} />
          )}

          {pairedList.length > 0 && (
            <Section title={SENSORS_COPY.yours}>
              <Card>
                {pairedList.map((sensor) => (
                  <PairedRow
                    key={sensor.kind}
                    sensor={sensor}
                    link={hub.links.find((l) => l.id === sensor.id)}
                    preview={readingText(sensor.kind, live, unitSystem)}
                  />
                ))}
              </Card>
            </Section>
          )}

          {state === 'ready' && (
            <Section title={SENSORS_COPY.nearby}>
              {failed && (
                <ThemedText type="small" themeColor="dangerText">
                  {SENSORS_COPY.scanFailed}
                </ThemedText>
              )}
              {groups.length === 0 && !failed && (
                <View accessibilityLiveRegion="polite" style={styles.group}>
                  <ThemedText type="small">{`${SENSORS_COPY.searching}…`}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {SENSORS_COPY.nothingFound}
                  </ThemedText>
                </View>
              )}
              {groups.map((group) => (
                <View key={group.kind} style={styles.group}>
                  <ThemedText type="smallBold">{SENSOR_KIND_LABEL[group.kind]}</ThemedText>
                  <Card>
                    {group.devices.map((device) => (
                      <NearbyRow
                        key={device.id}
                        device={device}
                        kind={group.kind}
                        onPick={() => choose(device, group.kind)}
                      />
                    ))}
                  </Card>
                </View>
              ))}
            </Section>
          )}

          {pairedIds.size > 0 && (
            <Section title={SENSORS_COPY.settings}>
              <Card>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold">{SENSORS_COPY.autoConnect}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {SENSORS_COPY.autoConnectNote}
                    </ThemedText>
                  </View>
                  <AppSwitch
                    checked={autoConnect}
                    onChange={setAutoConnect}
                    label={SENSORS_COPY.autoConnect}
                  />
                </View>
                {paired.speedCadence && (
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <ThemedText type="smallBold">{SENSORS_COPY.wheelSize}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {SENSORS_COPY.wheelSizeNote}
                      </ThemedText>
                    </View>
                    <Stepper
                      value={wheelMm}
                      step={WHEEL_STEP_MM}
                      min={WHEEL_MIN_MM}
                      max={WHEEL_MAX_MM}
                      onChange={setWheelMm}
                      format={(mm) => `${mm} mm`}
                      accessibilityLabel={SENSORS_COPY.wheelSize}
                    />
                  </View>
                )}
              </Card>
            </Section>
          )}
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
    gap: Spacing.three,
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
  section: { gap: Spacing.two },
  group: { gap: Spacing.one },
  card: { borderRadius: BorderRadius.md, padding: Spacing.three, gap: Spacing.two },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: Touch.target,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowActions: { alignItems: 'flex-end', gap: Spacing.one },
  forget: { minHeight: Spacing.five, justifyContent: 'center' },
});
