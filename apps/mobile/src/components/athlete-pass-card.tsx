import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorldVerificationStore } from '@/stores/worldVerificationStore';

/** The athlete's World ID Athlete Pass at a glance; opens the pass screen. */
export function AthletePassCard() {
  const router = useRouter();
  const theme = useTheme();
  const pass = useWorldVerificationStore((s) => s.pass);

  const subtitle = !pass
    ? 'Earn STRD for your runs: one World ID Selfie Check'
    : pass.band === 'high' && !pass.steppedUp
      ? 'Earning paused: verify with Proof of Human'
      : `${pass.presenceCount} ${pass.presenceCount === 1 ? 'run' : 'runs'} signed by you`;

  return (
    <Tappable
      onPress={() => router.push('/verify')}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="button"
      accessibilityLabel="Athlete Pass"
    >
      <Ionicons
        name={pass ? 'shield-checkmark' : 'finger-print'}
        size={24}
        color={pass ? Brand.verified : theme.brand.primary}
      />
      <View style={styles.copy}>
        <ThemedText type="smallBold">{pass ? 'Athlete Pass active' : 'Get your Athlete Pass'}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    alignSelf: 'stretch',
  },
  copy: { flex: 1, gap: Spacing.half },
});
