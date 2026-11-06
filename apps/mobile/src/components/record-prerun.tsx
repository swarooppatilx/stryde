import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import type { GpsSignal } from '@/utils/gpsSignal';
import type { ReadinessActionKind, ReadinessCheck } from '@/utils/readiness';
import { GpsSignalBar } from './gps-signal-bar';
import { LowPowerStatus } from './low-power-status';
import { ReadinessCard } from './readiness-card';
import { RecordSheet, SheetHandle } from './record-sheet';
import { SportCards } from './sport-cards';
import { Tappable } from './tappable';

interface RecordPreRunProps {
  signal: GpsSignal;
  /** Waiting for the first GPS answer after Start was pressed. */
  starting: boolean;
  /** The sport whose card Start was pressed. */
  onStart(type: ActivityType): void;
  onOpenSettings(): void;
  /** Opens the phone's own location settings, offered when location services are off. */
  onOpenLocationSettings?: () => void;
  /** Things that could quietly end a recording; the card is hidden when empty. */
  readiness?: ReadinessCheck[];
  onReadinessAction?: (kind: ReadinessActionKind) => void;
}

/** Everything before a recording: check the signal, then press Start on a sport's card. */
export function RecordPreRun({
  signal,
  starting,
  onStart,
  onOpenSettings,
  onOpenLocationSettings,
  readiness = [],
  onReadinessAction,
}: RecordPreRunProps) {
  const theme = useTheme();
  return (
    <RecordSheet>
      <SheetHandle />
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <GpsSignalBar signal={signal} onOpenLocationSettings={onOpenLocationSettings} />
        <View style={styles.headerSide}>
          <Tappable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Recording settings"
            style={styles.cog}
          >
            <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
          </Tappable>
        </View>
      </View>
      <LowPowerStatus />
      {onReadinessAction && <ReadinessCard rows={readiness} onAction={onReadinessAction} />}
      <SportCards disabled={starting} onStart={onStart} />
    </RecordSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  headerSide: { flex: 1, alignItems: 'flex-end' },
  cog: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
