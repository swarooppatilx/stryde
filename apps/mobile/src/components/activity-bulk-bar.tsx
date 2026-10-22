import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { SegmentedChoice } from '@/components/segmented-choice';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityPrivacy } from '@/types';
import { countOf } from '@/utils/plural';

const PRIVACY_CHOICES: { value: ActivityPrivacy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'only_me', label: 'Only Me' },
];

interface Props {
  count: number;
  onPrivacy(privacy: ActivityPrivacy): void;
  onDelete(): void;
}

/** What can be done to the picked activities: change who sees them, or delete them. */
export function ActivityBulkBar({ count, onPrivacy, onDelete }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
      ]}
    >
      <ThemedText type="smallBold">{countOf(count, 'activity', 'activities')} selected</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Who can see them
      </ThemedText>
      <SegmentedChoice<ActivityPrivacy>
        options={PRIVACY_CHOICES}
        selected={undefined}
        onSelect={onPrivacy}
        fill
      />
      <AppButton variant="danger" size="small" onPress={onDelete}>
        Delete
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
