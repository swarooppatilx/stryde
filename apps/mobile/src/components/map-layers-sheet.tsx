import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_CENTER, ENV } from '@/constants/config';
import { HEATMAP_COLOR_OPTIONS } from '@/constants/heatmapColors';
import { mapboxStyleUrl, staticPreviewUrl } from '@/constants/mapboxStyle';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  isLayerOn,
  type MapLayer,
  type MapStylePref,
  type MapType,
  resolveMapStyle,
  useMapPrefsStore,
} from '@/stores/mapPrefsStore';
import {
  HEATMAP_PERIOD_LABELS,
  HEATMAP_SOURCE_LABELS,
  type HeatmapPeriod,
  type HeatmapSource,
} from '@/utils/heatmap';
import { MAP_LAYER_OPTIONS } from '@/utils/mapLayerOptions';
import { MAP_STYLE_LABELS } from '@/utils/recordIsland';
import { AppSwitch } from './app-switch';
import { DayField } from './day-field';
import { ChipRow } from './filter-chips';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

const APPEARANCE_OPTIONS = (Object.keys(MAP_STYLE_LABELS) as MapStylePref[]).map((value) => ({
  value,
  label: MAP_STYLE_LABELS[value],
}));

const MAP_TYPES: ReadonlyArray<{
  value: MapType;
  label: string;
  icon: 'map-outline' | 'earth-outline' | 'layers-outline';
}> = [
  { value: 'standard', label: 'Standard', icon: 'map-outline' },
  { value: 'satellite', label: 'Satellite', icon: 'earth-outline' },
  { value: 'hybrid', label: 'Hybrid', icon: 'layers-outline' },
];

const startOfDay = (day: Date) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
const endOfDay = (day: Date) => startOfDay(day) + 86_400_000 - 1;
/** The last `n` days, today included. */
const lastDays = (n: number) => {
  const today = new Date();
  return {
    fromMs: startOfDay(new Date(today.getTime() - (n - 1) * 86_400_000)),
    toMs: endOfDay(today),
  };
};

const optionsOf = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
const HEAT_SOURCES = optionsOf<HeatmapSource>(HEATMAP_SOURCE_LABELS);
const HEAT_PERIODS = optionsOf<HeatmapPeriod>(HEATMAP_PERIOD_LABELS);
const HEAT_COLORS = HEATMAP_COLOR_OPTIONS;

interface MapLayersSheetProps {
  visible: boolean;
  onClose(): void;
  /** The switches that mean something on this map; a screen leaves out the ones it cannot draw. */
  layers: readonly MapLayer[];
  /** Where the map type previews are centred; the athlete's position when known. */
  previewCenter?: [number, number] | null;
}

/** One sheet for what the base map looks like and what is drawn on it: the map's layers button opens it. */
export function MapLayersSheet({ visible, onClose, layers, previewCenter }: MapLayersSheetProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const prefs = useMapPrefsStore();
  const appearanceDark = resolveMapStyle(prefs.style, theme.isDark) === 'dark';
  const center = previewCenter ?? DEFAULT_CENTER;

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
                {MAP_TYPES.map((type) => {
                  const selected = prefs.mapType === type.value;
                  return (
                    <Tappable
                      key={type.value}
                      onPress={() => prefs.setMapType(type.value)}
                      style={[
                        styles.tile,
                        { borderColor: selected ? theme.brand.primary : 'transparent' },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${type.label} map`}
                    >
                      <View style={[styles.swatch, { backgroundColor: theme.backgroundSelected }]}>
                        {ENV.MAPBOX_ACCESS_TOKEN ? (
                          <Image
                            source={{
                              uri: staticPreviewUrl(
                                mapboxStyleUrl(appearanceDark, type.value),
                                center,
                                ENV.MAPBOX_ACCESS_TOKEN
                              ),
                            }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            cachePolicy="disk"
                            transition={150}
                          />
                        ) : (
                          <Ionicons name={type.icon} size={28} color={theme.brand.primary} />
                        )}
                      </View>
                      <ThemedText type={selected ? 'smallBold' : 'caption'}>
                        {type.label}
                      </ThemedText>
                    </Tappable>
                  );
                })}
              </View>
              {prefs.mapType === 'standard' && (
                <ChipRow
                  options={APPEARANCE_OPTIONS}
                  value={prefs.style}
                  onChange={prefs.setStyle}
                  contentStyle={styles.chips}
                />
              )}
              <Tappable
                onPress={() => prefs.setTerrain3d(!prefs.terrain3d)}
                style={styles.row}
                accessibilityRole="switch"
                accessibilityState={{ checked: prefs.terrain3d }}
                accessibilityLabel="3D terrain"
              >
                <Ionicons name="triangle-outline" size={22} color={theme.text} />
                <View style={styles.rowText}>
                  <ThemedText>3D terrain</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Hills and valleys in 3D; the map tilts to show them
                  </ThemedText>
                </View>
                <AppSwitch
                  checked={prefs.terrain3d}
                  onChange={prefs.setTerrain3d}
                  label="3D terrain"
                />
              </Tappable>
            </View>

            <View style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Layers
              </ThemedText>
              {layers.map((layer) => {
                const option = MAP_LAYER_OPTIONS[layer];
                const on = isLayerOn(prefs, layer);
                const heatmapOptions = layer === 'heatmap' && on && (
                  <View style={styles.heatOptions}>
                    <ChipRow
                      options={HEAT_SOURCES}
                      value={prefs.heatmapSource}
                      onChange={(heatmapSource) => prefs.setHeatmap({ heatmapSource })}
                      contentStyle={styles.chips}
                    />
                    <ChipRow
                      options={HEAT_PERIODS}
                      value={prefs.heatmapPeriod}
                      onChange={(heatmapPeriod) =>
                        prefs.setHeatmap({
                          heatmapPeriod,
                          // "Dates" starts on the last 30 days until the athlete picks others.
                          ...(heatmapPeriod === 'custom' &&
                            !prefs.heatmapRange && { heatmapRange: lastDays(30) }),
                        })
                      }
                      contentStyle={styles.chips}
                    />
                    {prefs.heatmapPeriod === 'custom' && prefs.heatmapRange && (
                      <View style={styles.dates}>
                        <View style={styles.dateField}>
                          <ThemedText type="caption" themeColor="textSecondary">
                            From
                          </ThemedText>
                          <DayField
                            label="Heatmap from"
                            value={new Date(prefs.heatmapRange.fromMs)}
                            maximum={new Date(prefs.heatmapRange.toMs)}
                            onChange={(day) =>
                              prefs.setHeatmap({
                                heatmapRange: {
                                  fromMs: startOfDay(day),
                                  toMs: prefs.heatmapRange?.toMs ?? endOfDay(new Date()),
                                },
                              })
                            }
                          />
                        </View>
                        <View style={styles.dateField}>
                          <ThemedText type="caption" themeColor="textSecondary">
                            To
                          </ThemedText>
                          <DayField
                            label="Heatmap to"
                            value={new Date(prefs.heatmapRange.toMs)}
                            maximum={new Date()}
                            onChange={(day) =>
                              prefs.setHeatmap({
                                heatmapRange: {
                                  fromMs: Math.min(
                                    prefs.heatmapRange?.fromMs ?? startOfDay(day),
                                    startOfDay(day)
                                  ),
                                  toMs: endOfDay(day),
                                },
                              })
                            }
                          />
                        </View>
                      </View>
                    )}
                    <ChipRow
                      options={HEAT_COLORS}
                      value={prefs.heatmapColor}
                      onChange={(heatmapColor) => prefs.setHeatmap({ heatmapColor })}
                      contentStyle={styles.chips}
                    />
                  </View>
                );
                return (
                  <View key={layer}>
                    <Tappable
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
                    {heatmapOptions}
                  </View>
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
  heatColours: { gap: Spacing.one, paddingLeft: Spacing.five, paddingBottom: Spacing.two },
  tiles: { flexDirection: 'row', gap: Spacing.three },
  tile: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  swatch: {
    width: 96,
    height: 70,
    overflow: 'hidden',
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { paddingHorizontal: 0 },
  dates: { flexDirection: 'row', gap: Spacing.two },
  dateField: { flex: 1, gap: Spacing.one },
  heatOptions: { gap: Spacing.two, paddingLeft: 22 + Spacing.three, paddingBottom: Spacing.two },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: { flex: 1 },
});
