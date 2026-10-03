import { Switch } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the switch controls: read aloud by a screen reader, since the row's own text is a separate element. */
  label: string;
  disabled?: boolean;
}

/** An on/off switch in the app's colours that a screen reader can name. */
export function AppSwitch({ checked, onChange, label, disabled }: Props) {
  const theme = useTheme();
  return (
    <Switch
      value={checked}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="switch"
      trackColor={{ false: theme.borderBold, true: theme.brand.primary }}
      thumbColor={theme.brand.white}
    />
  );
}
