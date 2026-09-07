import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityPrivacy } from '@/types';
import { haptics } from '@/utils/haptics';

const PRIVACY_OPTIONS: {
  value: ActivityPrivacy;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}[] = [
  { value: 'everyone', icon: 'globe-outline', label: 'Everyone', description: 'Anyone can see' },
  { value: 'followers', icon: 'people-outline', label: 'Followers', description: 'Only followers' },
  { value: 'only_me', icon: 'lock-closed-outline', label: 'Only Me', description: 'Private' },
];

interface PrivacyPickerProps {
  selected: ActivityPrivacy;
  onSelect: (privacy: ActivityPrivacy) => void;
}

export function PrivacyPicker({ selected, onSelect }: PrivacyPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {PRIVACY_OPTIONS.map((option) => {
        const isSelected = option.value === selected;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              {
                backgroundColor: isSelected
                  ? tint(theme.brand.primary, 0.12)
                  : theme.backgroundElement,
                borderColor: isSelected ? theme.brand.primary : theme.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              haptics.selection();
              onSelect(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
          >
            <Ionicons
              name={option.icon}
              size={22}
              color={isSelected ? theme.brand.primary : theme.textSecondary}
            />
            <View style={styles.text}>
              <ThemedText
                type="smallBold"
                style={{ color: isSelected ? theme.brand.primary : theme.text }}
              >
                {option.label}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {option.description}
              </ThemedText>
            </View>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={20} color={theme.brand.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
