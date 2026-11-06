import { useRouter } from 'expo-router';
import { reapplySandboxSeed } from '@/backends/configure';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getPlatform } from '@/platform';
import { discardInFlightRun } from '@/services/discardInFlightRun';
import { trackingSession } from '@/services/trackingSession';
import { useActivityStore } from '@/stores/activityStore';
import { Alert } from '@/utils/alert';
import { deleteDataMessage } from '@/utils/deleteDataWarning';
import { logger } from '@/utils/logger';
import { resetAccountStores } from '@/utils/resetAccountStores';
import { unsyncedActivities } from '@/utils/unsyncedActivities';

/** Wipes this phone's account data (the unsent queue too) and signs out, without asking. Callers confirm first. */
export function useWipeLocalData() {
  const { logout } = useAuth();
  const router = useRouter();

  return async () => {
    await logout();
    await getOutbox().clear();
    await discardInFlightRun(getPlatform().storage, trackingSession);
    resetAccountStores();
    reapplySandboxSeed();
    router.replace('/login');
  };
}

/** Removes everything this phone holds about the account (including the unsent queue) and signs out; on-chain data stays, which the confirmation says first. */
export function useDeleteLocalData() {
  const t = useT();
  const wipe = useWipeLocalData();

  return () => {
    // Counted when asked, so the warning names what would be lost right now.
    const unsentChanges = getOutbox().entries().length;
    const unsavedActivities = unsyncedActivities(useActivityStore.getState().activities).length;
    Alert.alert(t('deleteData.title'), deleteDataMessage(unsentChanges, unsavedActivities, t), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('deleteData.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await wipe();
          } catch (error) {
            logger.error('[DeleteLocalData] Failed', error);
            Alert.alert(t('deleteData.failedTitle'), t('deleteData.failedBody'));
          }
        },
      },
    ]);
  };
}
