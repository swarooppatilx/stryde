import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { AppButton } from '@/components/button';
import { SettingsScreen } from '@/components/settings-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useWipeLocalData } from '@/hooks/useDeleteLocalData';
import { useOutboxEntries } from '@/hooks/useOutbox';
import {
  ACCOUNT_DELETE_KEY,
  requestAccountDeletion,
  takeDeletionCounts,
} from '@/services/accountDeletion';
import { exportMyData } from '@/services/exportMyData';
import {
  DELETE_CONFIRM_WORD,
  deletionCopy,
  isDeleteConfirmed,
  removedSummary,
} from '@/utils/accountDeletion';
import { Alert } from '@/utils/alert';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

type Phase = 'form' | 'sending' | 'queued' | 'refused';

export default function DeleteAccountScreen() {
  const wipe = useWipeLocalData();
  const entries = useOutboxEntries();
  const waiting = entries.some((entry) => entry.key === ACCOUNT_DELETE_KEY);
  const [phase, setPhase] = useState<Phase>(waiting ? 'queued' : 'form');
  const [typed, setTyped] = useState('');

  const finish = async () => {
    const counts = takeDeletionCounts();
    try {
      await wipe();
      Alert.alert(
        'Account deleted',
        `${counts ? removedSummary(counts) : 'Your request was sent.'}\n\n${deletionCopy.permanent}`
      );
    } catch (error) {
      logger.error('[DeleteAccount] Wiping this phone failed', error);
      Alert.alert(
        'Could not clear this phone',
        'Your account data was removed. Log out to finish.'
      );
    }
  };

  const request = async () => {
    setPhase('sending');
    try {
      const outcome = await requestAccountDeletion(getOutbox());
      if (outcome === 'sent') await finish();
      else setPhase(outcome);
    } catch (error) {
      logger.warn('[DeleteAccount] Request failed', error);
      setPhase('queued');
    }
  };

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  useEffect(() => {
    if (phase !== 'queued' || waiting) return;
    if (getOutbox().consumeRejection(ACCOUNT_DELETE_KEY)) setPhase('refused');
    else void finishRef.current();
  }, [phase, waiting]);

  const confirmed = isDeleteConfirmed(typed);

  return (
    <SettingsScreen title="Delete my account">
      <ThemedText>{deletionCopy.intro}</ThemedText>
      <ThemedText themeColor="textSecondary">{deletionCopy.permanent}</ThemedText>

      {phase === 'queued' ? (
        <ThemedText accessibilityLiveRegion="polite">{deletionCopy.queued}</ThemedText>
      ) : null}
      {phase === 'refused' ? (
        <ThemedText themeColor="dangerText" accessibilityLiveRegion="polite">
          {deletionCopy.refused}
        </ThemedText>
      ) : null}

      {phase === 'form' || phase === 'sending' || phase === 'refused' ? (
        <View style={{ gap: Spacing.three, marginTop: Spacing.two }}>
          <ThemedText themeColor="textSecondary">{deletionCopy.exportFirst}</ThemedText>
          <AppButton
            variant="secondary"
            onPress={() =>
              exportMyData().catch((error) => {
                logger.warn('[DeleteAccount] Export failed', error);
                Toast.fail("Couldn't export your data", 2);
              })
            }
          >
            Export my data
          </AppButton>
          <TextField
            label={`Type ${DELETE_CONFIRM_WORD} to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <AppButton
            variant="danger"
            disabled={!confirmed}
            loading={phase === 'sending'}
            onPress={request}
          >
            Delete my account
          </AppButton>
        </View>
      ) : null}
    </SettingsScreen>
  );
}
