import { Ionicons } from '@expo/vector-icons';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import type { Gender } from '@/types';
import { ThemedText } from './themed-text';

const GENDER_OPTIONS: { value: Gender; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'man', label: 'Man', icon: 'male' },
  { value: 'woman', label: 'Woman', icon: 'female' },
  { value: 'non_binary', label: 'Non-binary', icon: 'male-female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'person' },
];

interface Props {
  selected: Gender;
  onSelect(gender: Gender): void;
  /** `brand` for onboarding (orange-tinted cards), `neutral` inside forms. */
  tone?: 'brand' | 'neutral';
  style?: StyleProp<ViewStyle>;
}

export function GenderPicker({ selected, onSelect, tone = 'neutral', style }: Props) {
  const theme = useTheme();
  const idle =
    tone === 'brand'
      ? {
          background: tint(Brand.primary, 0.06),
          border: tint(Brand.primary, 0.19),
          text: Brand.primary,
        }
      : { background: theme.backgroundElement, border: theme.border, text: theme.text };

  return (
    <View style={[styles.grid, style]} accessibilityRole="radiogroup">
      {GENDER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        const color = isSelected ? Brand.white : idle.text;
        return (
          <Tappable
            key={option.value}
            style={[
              styles.card,
              {
                backgroundColor: isSelected ? Brand.primary : idle.background,
                borderColor: isSelected ? Brand.primary : idle.border,
              },
            ]}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <Ionicons name={option.icon} size={20} color={color} />
            <ThemedText style={[styles.label, { color }]}>{option.label}</ThemedText>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  label: textStyle(TypeScale.calloutBold),
});
