import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Activity } from '@/types';

const COPY: Record<NonNullable<Activity['rewardHold']>, { title: string; body: string }> = {
  enroll_required: {
    title: 'Reward waiting for your Athlete Pass',
    body: 'One Selfie Check in World App, once, and this run starts earning.',
  },
  presence_required: {
    title: 'Sign this run to release the reward',
    body: 'A 5-second Finish-Line check proves you, not a bot or a borrowed phone, ran it.',
  },
  step_up_required: {
    title: 'Earning paused for this account',
    body: 'Your Selfie Check looked like many others. Proof of Human unlocks earning.',
  },
};

/** A run whose reward the server is holding for a World ID check; tapping opens the Finish-Line screen. */
export function RewardHoldBanner({ activity }: { activity: Activity }) {
  const router = useRouter();
  const theme = useTheme();
  if (!activity.rewardHold) return null;
  const copy = COPY[activity.rewardHold];

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/finish-line', params: { id: activity.id } })}
      style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: Brand.verified }]}
      accessibilityRole="button"
      accessibilityLabel={copy.title}
    >
      <Ionicons name="finger-print" size={26} color={Brand.verified} />
      <View style={styles.copy}>
        <ThemedText type="smallBold">{copy.title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {copy.body}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  copy: { flex: 1, gap: Spacing.half },
});
