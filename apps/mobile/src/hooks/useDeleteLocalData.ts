import { useRouter } from 'expo-router';
import { reapplySandboxSeed } from '@/backends/configure';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { useAuth } from '@/hooks/useAuth';
import { getPlatform } from '@/platform';
import { discardInFlightRun } from '@/services/discardInFlightRun';
import { trackingSession } from '@/services/trackingSession';
import { useActivityStore } from '@/stores/activityStore';
import { Alert } from '@/utils/alert';
import { deleteDataMessage } from '@/utils/deleteDataWarning';
import { logger } from '@/utils/logger';
import { resetAccountStores } from '@/utils/resetAccountStores';
import { unsyncedActivities } from '@/utils/unsyncedActivities';

/** Removes everything this phone holds about the account (including the unsent queue) and signs out; on-chain data stays, which the confirmation says first. */
export function useDeleteLocalData() {
  const { logout } = useAuth();
  const router = useRouter();

  return () => {
    // Counted when asked, so the warning names what would be lost right now.
    const unsentChanges = getOutbox().entries().length;
    const unsavedActivities = unsyncedActivities(useActivityStore.getState().activities).length;
    Alert.alert(
      'Delete data on this device?',
      deleteDataMessage(unsentChanges, unsavedActivities),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete and log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              await getOutbox().clear();
              await discardInFlightRun(getPlatform().storage, trackingSession);
              resetAccountStores();
              reapplySandboxSeed();
              router.replace('/login');
            } catch (error) {
              logger.error('[DeleteLocalData] Failed', error);
              Alert.alert('Could not delete the data', 'Please try again.');
            }
          },
        },
      ]
    );
  };
}
