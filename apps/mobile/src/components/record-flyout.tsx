import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FlyoutRow, FlyoutRowId } from '@/utils/recordIsland';
import { AppSwitch } from './app-switch';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface RecordFlyoutProps {
  rows: FlyoutRow[];
  trackLaps: boolean;
  onToggleLaps(on: boolean): void;
  onOpen(id: Exclude<FlyoutRowId, 'laps' | 'share' | 'sensor'>): void;
}

/** The options a drag up from the handle reveals; each row says what it is set to. */
export function RecordFlyout({ rows, trackLaps, onToggleLaps, onOpen }: RecordFlyoutProps) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {rows.map((row) => {
        const text = (
          <View style={styles.text}>
            <ThemedText type="smallBold" themeColor={row.available ? 'text' : 'textSecondary'}>
              {row.title}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.subtitle}
            </ThemedText>
          </View>
        );
        const style = [styles.row, { borderBottomColor: theme.border }];
        if (row.id === 'laps') {
          return (
            <View key={row.id} style={style}>
              {text}
              <AppSwitch checked={trackLaps} onChange={onToggleLaps} label="Track laps" />
            </View>
          );
        }
        if (row.id === 'settings' || row.id === 'layers') {
          const id = row.id;
          return (
            <Tappable
              key={row.id}
              style={style}
              onPress={() => onOpen(id)}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}. ${row.subtitle}`}
            >
              {text}
              <Ionicons name="chevron-forward" size={IconSize.inline} color={theme.textSecondary} />
            </Tappable>
          );
        }
        return (
          <View
            key={row.id}
            style={style}
            accessible
            accessibilityLabel={`${row.title}. ${row.subtitle}`}
          >
            {text}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Touch.target,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  text: { flex: 1, minWidth: 0 },
});
