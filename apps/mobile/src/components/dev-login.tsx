import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveProfileId } from '@/backends/activeProfile';
import { signInAs } from '@/backends/auth/devSession';
import { PERSONAS } from '@/backends/auth/personas';
import { PROFILES } from '@/backends/profiles';
import { BrandWordmark } from '@/components/brand';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The login screen for the Local and Sandbox profiles: pick a developer persona instead of an email code. */
export function DevLogin() {
  const theme = useTheme();
  const router = useRouter();
  const profile = PROFILES[getActiveProfileId()];

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BrandWordmark width={140} color={theme.text} />
          <ThemedText type="headline">Developer login</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profile.label} profile. Choose who to sign in as; no account or code is needed.
          </ThemedText>
        </View>
        {PERSONAS.map((persona) => (
          <Tappable
            key={persona.id}
            onPress={() => {
              signInAs(persona.id);
              router.replace('/');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Sign in as ${persona.label}`}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="sectionTitle">{persona.label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {persona.description}
            </ThemedText>
          </Tappable>
        ))}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.three },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.three, gap: Spacing.one },
});
