import { Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function MapSearchBar() {
  const theme = useTheme();

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <TouchableOpacity
        style={styles.sportPicker}
        activeOpacity={0.7}
        onPress={() => Toast.show({ content: 'Sport filter coming soon', duration: 1 })}
        accessibilityRole="button"
        accessibilityLabel="Select sport"
      >
        <Ionicons name="bicycle" size={20} color={theme.brand.primary} />
        <Ionicons name="chevron-down" size={14} color={theme.brand.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.searchInput}
        activeOpacity={0.7}
        onPress={() => Toast.show({ content: 'Search coming soon', duration: 1 })}
        accessibilityRole="search"
        accessibilityLabel="Search locations"
      >
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Search locations
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.savedBtn}
        activeOpacity={0.7}
        onPress={() => Toast.show({ content: 'Saved routes coming soon', duration: 1 })}
        accessibilityRole="button"
        accessibilityLabel="Saved routes"
      >
        <Ionicons name="bookmark-outline" size={20} color={theme.text} />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sportPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
  },
  savedBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
