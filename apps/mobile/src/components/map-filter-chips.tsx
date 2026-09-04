import { Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ChipProps {
  label: string;
  active?: boolean;
  showChevron?: boolean;
  onPress: () => void;
}

function Chip({ label, active, showChevron, onPress }: ChipProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active ? tint(theme.brand.primary, 0.12) : theme.backgroundElement,
          borderColor: active ? theme.brand.primary : theme.border,
        },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <ThemedText
        type="small"
        style={{ color: active ? theme.brand.primary : theme.text, fontWeight: '600' }}
      >
        {label}
      </ThemedText>
      {showChevron && (
        <Ionicons name="chevron-down" size={12} color={active ? theme.brand.primary : theme.text} />
      )}
    </TouchableOpacity>
  );
}

export function MapFilterChips() {
  const handlePress = (filter: string) => {
    Toast.show({ content: `${filter} filter coming soon`, duration: 1 });
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      <Chip label="Routes" showChevron active onPress={() => handlePress('Routes')} />
      <Chip label="Length" onPress={() => handlePress('Length')} />
      <Chip label="Elevation" onPress={() => handlePress('Elevation')} />
      <Chip label="Surface" onPress={() => handlePress('Surface')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 108,
    left: 0,
    right: 0,
  },
  row: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
