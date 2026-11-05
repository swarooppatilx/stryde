import { useRouter } from 'expo-router';
import { reapplySandboxSeed } from '@/backends/configure';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { pushNotifications } from '@/backends/pushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { Alert } from '@/utils/alert';
import { logger } from '@/utils/logger';
import { resetAccountStores } from '@/utils/resetAccountStores';

/** Asks first, then signs out, clears every local store and returns to login. */
export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();

  return () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            // While the account can still sign it, and never blocking the sign-out on a server that is down.
            await pushNotifications.unregister();
            await logout();
            // Unsent actions belong to this account; they must not be sent for the next one.
            await getOutbox().clear();
            resetAccountStores();
            reapplySandboxSeed();
            router.replace('/login');
          } catch (error) {
            logger.error('[Logout] Failed', error);
            Alert.alert('Log out failed', 'Please try again.');
          }
        },
      },
    ]);
  };
}
