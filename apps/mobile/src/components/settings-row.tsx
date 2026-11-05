import { List } from '@ant-design/react-native';
import type { Ionicons } from '@expo/vector-icons';
import type { ReactElement, ReactNode } from 'react';
import { ListIcon } from '@/components/list-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** The row's current value or a one-line explanation. */
  subtitle?: string;
  /** Right-hand content: a switch, or a short value. */
  extra?: ReactNode;
  /** Makes the row a link: a chevron shows. */
  onPress?: () => void;
  danger?: boolean;
}

/** One row of a settings list; every settings screen builds from this so they look the same. */
export function SettingsRow({ icon, title, subtitle, extra, onPress, danger }: SettingsRowProps) {
  const theme = useTheme();
  return (
    <List.Item
      thumb={<ListIcon name={icon} />}
      onPress={onPress}
      arrow={onPress ? 'horizontal' : undefined}
      extra={extra}
      // antd renders element children in a View and drops their colour; its own slot keeps it.
      styles={danger ? { Content: { color: theme.dangerText } } : undefined}
    >
      {title}
      {subtitle ? <List.Item.Brief>{subtitle}</List.Item.Brief> : false}
    </List.Item>
  );
}

interface SettingsSectionProps {
  title?: string;
  /** Small explanation under the list. */
  footer?: string;
  children: ReactElement | ReactElement[];
}

/** A titled group of rows with an optional footnote. */
export function SettingsSection({ title, footer, children }: SettingsSectionProps) {
  return (
    <>
      {title ? (
        <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
          {title.toUpperCase()}
        </ThemedText>
      ) : null}
      <List>{children}</List>
      {footer ? (
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
          {footer}
        </ThemedText>
      ) : null}
    </>
  );
}
