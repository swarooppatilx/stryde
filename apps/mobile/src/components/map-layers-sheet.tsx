import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  isLayerOn,
  type MapLayer,
  type MapStylePref,
  useMapPrefsStore,
} from '@/stores/mapPrefsStore';
import { MAP_LAYER_OPTIONS } from '@/utils/mapLayerOptions';
import { MAP_STYLE_LABELS } from '@/utils/recordIsland';
import { AppSwitch } from './app-switch';
import { ChipRow } from './filter-chips';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

const APPEARANCE_OPTIONS = (Object.keys(MAP_STYLE_LABELS) as MapStylePref[]).map((value) => ({
  value,
  label: MAP_STYLE_LABELS[value],
}));

interface MapLayersSheetProps {
  visible: boolean;
  onClose(): void;
  /** The switches that mean something on this map; a screen leaves out the ones it cannot draw. */
  layers: readonly MapLayer[];
}

/** One sheet for what the base map looks like and what is drawn on it: the map's layers button opens it. */
export function MapLayersSheet({ visible, onClose, layers }: MapLayersSheetProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const prefs = useMapPrefsStore();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close map layers"
      />
      <View style={styles.anchor} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundElement, paddingBottom: bottom + Spacing.two },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <ThemedText type="sectionTitle">Map layers</ThemedText>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Map type
              </ThemedText>
              <View style={styles.tiles}>
                <View
                  style={[styles.tile, { borderColor: theme.brand.primary }]}
                  accessible
                  accessibilityRole="radio"
                  accessibilityState={{ selected: true }}
                  accessibilityLabel="Standard map"
                >
                  <View style={[styles.swatch, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="map-outline" size={28} color={theme.brand.primary} />
                  </View>
                  <ThemedText type="caption">Standard</ThemedText>
                </View>
              </View>
              <ChipRow
                options={APPEARANCE_OPTIONS}
                value={prefs.style}
                onChange={prefs.setStyle}
                contentStyle={styles.chips}
              />
            </View>

            <View style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Layers
              </ThemedText>
              {layers.map((layer) => {
                const option = MAP_LAYER_OPTIONS[layer];
                const on = isLayerOn(prefs, layer);
                return (
                  <Tappable
                    key={layer}
                    onPress={() => prefs.setLayer(layer, !on)}
                    style={styles.row}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={option.label}
                    accessibilityHint={option.hint}
                  >
                    <Ionicons name={option.icon} size={22} color={theme.text} />
                    <View style={styles.rowText}>
                      <ThemedText>{option.label}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {option.hint}
                      </ThemedText>
                    </View>
                    <AppSwitch
                      checked={on}
                      onChange={(next) => prefs.setLayer(layer, next)}
                      label={option.label}
                    />
                  </Tappable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  content: { gap: Spacing.four, paddingBottom: Spacing.two },
  section: { gap: Spacing.two },
  tiles: { flexDirection: 'row', gap: Spacing.three },
  tile: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  swatch: {
    width: 88,
    height: 64,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { paddingHorizontal: 0 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: { flex: 1 },
});
