import { Ionicons } from '@expo/vector-icons';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Tappable } from '@/components/tappable';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props<T extends string> {
  tabs: readonly T[];
  active: T;
  onChange(tab: T): void;
  style?: StyleProp<ViewStyle>;
  /** An icon above each label, when given. */
  icons?: Partial<Record<T, keyof typeof Ionicons.glyphMap>>;
}

/** A row of text tabs with an underline under the active one. */
export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  style,
  icons,
}: Props<T>) {
  const theme = useTheme();
  return (
    <View
      style={[styles.bar, { borderBottomColor: theme.border }, style]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <Tappable
            key={tab}
            style={[styles.tab, selected && { borderBottomColor: theme.brand.primary }]}
            onPress={() => onChange(tab)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            {icons?.[tab] && (
              <Ionicons
                name={icons[tab]}
                size={24}
                color={selected ? theme.brand.primary : theme.textSecondary}
              />
            )}
            <ThemedText
              type="small"
              style={{
                fontWeight: selected ? '700' : '500',
                color: selected ? theme.brand.primary : theme.textSecondary,
              }}
            >
              {tab}
            </ThemedText>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
});
