import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmit,
  accessibilityLabel,
  style,
}: SearchBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}
    >
      <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        enablesReturnKeyAutomatically
        onSubmitEditing={onSubmit}
        accessibilityLabel={accessibilityLabel ?? placeholder}
      />
      {value.length > 0 && (
        <Tappable
          onPress={() => onChangeText('')}
          hitSlop={13}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Tappable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...textStyle(TypeScale.callout),
    padding: 0,
  },
});
