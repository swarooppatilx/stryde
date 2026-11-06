import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MapChrome } from '@/constants/mapChrome';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import { SPORT_FILTERS, SPORT_LABELS, type SportFilter } from './filter-chips';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

const SPORT_ICONS: Record<SportFilter, keyof typeof Ionicons.glyphMap> = {
  all: 'apps-outline',
  run: 'walk-outline',
  ride: 'bicycle-outline',
  hike: 'leaf-outline',
  swim: 'water-outline',
  multi: 'layers-outline',
};

/** What the search hint suggests in turn: places athletes look for before heading out. */
const SEARCH_HINTS = ['places', 'cafés', 'parks', 'drinking water', 'trailheads', 'viewpoints'];
const HINT_MS = 3000;

interface MapSearchBarProps {
  query: string;
  onChangeQuery(text: string): void;
  sport: SportFilter;
  onChangeSport(sport: SportFilter): void;
  /** The keyboard's search key: open the best match. */
  onSubmit(): void;
}

/** One rounded bar: the sport filter on the left, place search filling the rest. */
export function MapSearchBar({
  query,
  onChangeQuery,
  sport,
  onChangeSport,
  onSubmit,
}: MapSearchBarProps) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  // While the field is empty and idle, the hint cycles through things worth searching for.
  const [focused, setFocused] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const reduceMotion = useReduceMotion();
  const cycling = !focused && !query && !reduceMotion;
  useEffect(() => {
    if (!cycling) return;
    const timer = setInterval(() => setHintIndex((i) => (i + 1) % SEARCH_HINTS.length), HINT_MS);
    return () => clearInterval(timer);
  }, [cycling]);
  const placeholder = reduceMotion ? 'Search places' : `Search ${SEARCH_HINTS[hintIndex]}`;
  return (
    <View>
      <View
        style={[styles.bar, theme.shadows.raised, { backgroundColor: theme.backgroundElement }]}
      >
        <Tappable
          onPress={() => setMenuOpen((open) => !open)}
          style={styles.sport}
          accessibilityRole="button"
          accessibilityLabel={`Sport: ${SPORT_LABELS[sport]}`}
          accessibilityState={{ expanded: menuOpen }}
        >
          <Ionicons name={SPORT_ICONS[sport]} size={22} color={theme.brand.primary} />
          {/* A narrowed filter is named, so the athlete can tell why the map shows fewer routes; "All" stays an icon to leave room for the search. */}
          {sport !== 'all' && (
            <ThemedText type="smallBold" numberOfLines={1}>
              {SPORT_LABELS[sport]}
            </ThemedText>
          )}
          <Ionicons name={menuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.text} />
        </Tappable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={() => {
            setFocused(true);
            setMenuOpen(false);
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          enablesReturnKeyAutomatically
          accessibilityLabel="Search places"
        />
        {query.length > 0 && (
          <Tappable
            onPress={() => onChangeQuery('')}
            hitSlop={12}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </Tappable>
        )}
      </View>
      {menuOpen && (
        <View
          style={[styles.menu, theme.shadows.overlay, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="radiogroup"
        >
          {SPORT_FILTERS.map((value) => (
            <Tappable
              key={value}
              onPress={() => {
                haptics.selection();
                onChangeSport(value);
                setMenuOpen(false);
              }}
              style={styles.menuRow}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === sport }}
            >
              <Ionicons
                name={SPORT_ICONS[value]}
                size={20}
                color={value === sport ? theme.brand.primary : theme.text}
              />
              <ThemedText type={value === sport ? 'smallBold' : 'small'}>
                {SPORT_LABELS[value]}
              </ThemedText>
            </Tappable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: MapChrome.searchHeight,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  sport: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: Spacing.two },
  input: { flex: 1, ...textStyle(TypeScale.body), paddingVertical: 0 },
  clear: { paddingHorizontal: Spacing.one },
  menu: {
    marginTop: Spacing.one,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
});
