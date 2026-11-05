import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AlertSeverity } from '@/utils/stakeAlerts';
import { ThemedText } from './themed-text';

const NOTICE_TINT = 0.12;

const ICONS: Record<AlertSeverity, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  warning: 'warning-outline',
  danger: 'close-circle-outline',
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: 'Note',
  warning: 'Warning',
  danger: 'Problem',
};

interface NoticeProps {
  severity: AlertSeverity;
  children: ReactNode;
}

/** A short boxed message whose colour and icon say how serious it is; read aloud with that level. */
export function Notice({ severity, children }: NoticeProps) {
  const theme = useTheme();
  const color = { info: Brand.info, warning: Brand.warning, danger: Brand.danger }[severity];
  return (
    <View
      accessible
      accessibilityLabel={SEVERITY_LABEL[severity]}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: tint(color, NOTICE_TINT), borderColor: color }]}
    >
      <Ionicons name={ICONS[severity]} size={18} color={color} />
      <ThemedText type="small" style={[styles.text, { color: theme.text }]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.twoHalf,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1 },
});
