import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SetupGoalStep } from '@/components/setup-goal-step';
import { SetupPeopleStep } from '@/components/setup-people-step';
import { SetupPermissionsStep } from '@/components/setup-permissions-step';
import { SetupSportsStep } from '@/components/setup-sports-step';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SETUP_COPY } from '@/constants/copy';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useSetupStore } from '@/stores/setupStore';
import { confirmSkipSetup } from '@/utils/confirmSkipSetup';
import {
  isSetupStep,
  SETUP_STEPS,
  type SetupStep,
  shouldConfirmSkip,
  stepAfter,
  stepBefore,
} from '@/utils/setupFlow';

const TITLES: Record<SetupStep, { title: string; body: string }> = {
  sports: SETUP_COPY.sports,
  goal: SETUP_COPY.goal,
  permissions: SETUP_COPY.permissions,
  people: SETUP_COPY.people,
};

/**
 * The short flow after profile setup. Opened with `?step=` it shows just that step and returns, which
 * is how the Getting started card reaches a single part of it.
 */
export default function MakeItYoursScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const account = useCurrentUserId();
  const finish = useSetupStore((s) => s.finish);
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const only = isSetupStep(stepParam) ? stepParam : null;
  const [step, setStep] = useState<SetupStep>(only ?? 'sports');
  const skipConfirmed = useRef(false);

  const leave = () => {
    if (only) {
      goBack();
      return;
    }
    finish(account);
    router.replace('/(tabs)');
  };
  const next = () => {
    const after = only ? null : stepAfter(step);
    if (after) setStep(after);
    else leave();
  };
  const skip = () => {
    if (!shouldConfirmSkip(skipConfirmed.current) || only) {
      next();
      return;
    }
    confirmSkipSetup(() => {
      skipConfirmed.current = true;
      next();
    });
  };
  const before = only ? null : stepBefore(step);
  const back = () => {
    if (before) setStep(before);
    else if (only) goBack();
    else skip();
  };

  // The phone's back button walks the steps in reverse; on the first it offers to skip instead of closing.
  useBackHandler(back);

  const position = SETUP_STEPS.indexOf(step) + 1;
  const { title, body } = TITLES[step];

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {before || only ? (
            <Tappable
              onPress={back}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={SETUP_COPY.back}
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Tappable>
          ) : (
            <View style={styles.spacer} />
          )}
          {!only && (
            <ThemedText type="caption" themeColor="textSecondary">
              {`${position} of ${SETUP_STEPS.length}`}
            </ThemedText>
          )}
          {only ? (
            <View style={styles.spacer} />
          ) : (
            <Tappable
              onPress={skip}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={SETUP_COPY.skip}
            >
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {SETUP_COPY.skip}
              </ThemedText>
            </Tappable>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.titles}>
            <ThemedText type="display" accessibilityRole="header">
              {title}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{body}</ThemedText>
          </View>
          {step === 'sports' && <SetupSportsStep onNext={next} />}
          {step === 'goal' && <SetupGoalStep onNext={next} />}
          {step === 'permissions' && <SetupPermissionsStep onNext={next} />}
          {step === 'people' && <SetupPeopleStep onNext={next} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  spacer: { width: 24 },
  scroll: { padding: Spacing.four, gap: Spacing.four },
  titles: { gap: Spacing.two },
});
