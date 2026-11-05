import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityPrivacy } from '@/types';
import { haptics } from '@/utils/haptics';
import { privacyOptionDescription } from '@/utils/privacyNotes';

const PRIVACY_OPTIONS: {
  value: ActivityPrivacy;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { value: 'everyone', icon: 'globe-outline', label: 'Everyone' },
  { value: 'followers', icon: 'people-outline', label: 'Followers' },
  { value: 'only_me', icon: 'lock-closed-outline', label: 'Only Me' },
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
        const description = privacyOptionDescription(option.value);
        return (
          <Tappable
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
            accessibilityLabel={`${option.label}. ${description}`}
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
              <ThemedText type="caption" themeColor="textSecondary">
                {description}
              </ThemedText>
            </View>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={20} color={theme.brand.primary} />
            )}
          </Tappable>
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
    gap: Spacing.half,
  },
});
