import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { getWorldEnvironmentLabel } from '@/services/worldIdService';

const VERIFY_BLUE = '#1D9BF0';

export default function VerifyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    isVerified,
    verifiedAt,
    status,
    error,
    isConfigured,
    startVerification,
    resetFlow,
    isBusy,
  } = useWorldVerification();

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => router.back(), 1200);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  const statusMessage =
    status === 'opening'
      ? 'Opening World ID\u2026'
      : status === 'polling'
        ? 'Complete Selfie Check in World ID, then return here.'
        : null;

  const verifiedDate =
    verifiedAt &&
    new Date(verifiedAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="headline">Verification</ThemedText>
          <View style={styles.iconBtn} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.hero}>
            <ThemedView style={[styles.heroIcon, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons
                name={isVerified ? 'checkmark-circle' : 'shield-checkmark'}
                size={40}
                color={isVerified ? VERIFY_BLUE : theme.brand.primary}
              />
            </ThemedView>
            <ThemedText style={styles.heroTitle}>
              {isVerified ? 'You are verified' : 'Verify you are human'}
            </ThemedText>
            <ThemedText type="small" style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              {isVerified
                ? `Selfie Check confirmed on ${verifiedDate}. Your profile shows a verified badge.`
                : 'Stryde uses World ID Selfie Check to reduce fake accounts and protect territory claims.'}
            </ThemedText>
          </ThemedView>

          {!isVerified && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Why verify?</ThemedText>
              <BenefitRow
                icon="person-outline"
                title="Real athlete badge"
                body="Show a verified check on your profile, similar to social apps."
              />
              <BenefitRow
                icon="map-outline"
                title="Fair territory play"
                body="Selfie Check adds friction against bots and duplicate accounts."
              />
              <BenefitRow
                icon="lock-closed-outline"
                title="Privacy preserving"
                body="World ID proves you are a real person without sharing your identity."
              />
            </Card>
          )}

          {!isConfigured && (
            <Card style={styles.warningCard}>
              <ThemedText type="sectionTitle">Setup required</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Add your World app credentials to the mobile .env file:
              </ThemedText>
              <ThemedText type="caption" style={styles.mono}>
                EXPO_PUBLIC_WORLD_APP_ID, EXPO_PUBLIC_WORLD_RP_ID, EXPO_PUBLIC_WORLD_ENVIRONMENT
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: Spacing.two }}
              >
                The API server handles World ID request signing; nothing to run locally.
              </ThemedText>
            </Card>
          )}

          {statusMessage && (
            <Card style={styles.card}>
              <ThemedView style={styles.statusRow}>
                <Ionicons name="hourglass-outline" size={18} color={theme.brand.primary} />
                <ThemedText type="small">{statusMessage}</ThemedText>
              </ThemedView>
            </Card>
          )}

          {error && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle" style={{ color: theme.brand.danger }}>
                Verification failed
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {error.message}
              </ThemedText>
            </Card>
          )}

          {status === 'success' && (
            <Card style={styles.card}>
              <ThemedView style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={18} color={VERIFY_BLUE} />
                <ThemedText type="small">
                  Verification complete. Returning to profile\u2026
                </ThemedText>
              </ThemedView>
            </Card>
          )}

          <Card style={styles.card}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Integration
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Environment: {getWorldEnvironmentLabel(ENV.WORLD_ENVIRONMENT)}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: Spacing.one }}
            >
              Status is stored locally on this device for the hackathon demo.
            </ThemedText>
          </Card>

          {!isVerified ? (
            <AppButton
              onPress={startVerification}
              loading={isBusy}
              disabled={!isConfigured || isBusy}
              icon={<Ionicons name="scan-outline" size={18} color={Brand.white} />}
            >
              Verify with World ID
            </AppButton>
          ) : (
            <AppButton variant="secondary" onPress={() => router.back()}>
              Back to profile
            </AppButton>
          )}

          {error && (
            <TouchableOpacity onPress={resetFlow} style={styles.retryLink}>
              <ThemedText type="small" style={{ color: theme.brand.primary }}>
                Reset and try again
              </ThemedText>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function BenefitRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.benefitRow}>
      <Ionicons name={icon} size={18} color={theme.brand.primary} />
      <ThemedView style={styles.benefitCopy}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {body}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  warningCard: {
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.warning,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  benefitCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  mono: {
    fontFamily: 'monospace',
    marginTop: Spacing.two,
  },
  retryLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
