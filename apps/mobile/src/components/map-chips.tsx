import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet } from 'react-native';
import { MapChrome } from '@/constants/mapChrome';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

export interface MapChip {
  key: string;
  label: string;
  active: boolean;
  /** A filter that opens a list: shown with a chevron. */
  menu?: boolean;
  onPress(): void;
}

/** One scrolling row of pills; an active pill is filled with a brand tint and takes the brand text. */
export function MapChips({ chips }: { chips: readonly MapChip[] }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {chips.map((chip) => (
        <Tappable
          key={chip.key}
          onPress={() => {
            haptics.selection();
            chip.onPress();
          }}
          style={[
            styles.chip,
            theme.shadows.raised,
            // Solid when on, so a selected chip still reads over satellite imagery.
            { backgroundColor: chip.active ? theme.brand.primary : theme.backgroundElement },
          ]}
          accessibilityRole="button"
          accessibilityLabel={chip.menu ? `${chip.label}, change filter` : chip.label}
          accessibilityState={{ selected: chip.active }}
        >
          <ThemedText
            type="smallBold"
            themeColor={chip.active ? undefined : 'text'}
            style={chip.active ? { color: Palette.white } : undefined}
          >
            {chip.label}
          </ThemedText>
          {chip.menu && (
            <Ionicons
              name="chevron-down"
              size={14}
              color={chip.active ? Palette.white : theme.text}
            />
          )}
        </Tappable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so chips scroll under the gutter instead of clipping at it.
  scroll: { marginHorizontal: -MapChrome.edge, flexGrow: 0 },
  row: { paddingHorizontal: MapChrome.edge, gap: Spacing.two },
  chip: {
    height: MapChrome.chipHeight,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
