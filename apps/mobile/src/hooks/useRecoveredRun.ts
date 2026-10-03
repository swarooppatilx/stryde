import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { getPlatform } from '@/platform';
import { trackingSession } from '@/services/trackingSession';
import { Alert } from '@/utils/alert';
import { logger } from '@/utils/logger';
import { describeRecoverableRun, TRACKING_STORAGE_KEY } from '@/utils/recoverableRun';
import { useUnitSystem } from './use-unit-system';

/** What the Record tab should do once it has picked the run back up. */
export type RecoveryChoice = 'save' | 'discard';

/** Asked at most once per launch, whichever screen the app opens on. */
let asked = false;

/** After a mid-recording kill, announces it once at launch and routes to the Record tab, which owns resume/save/discard. Only reads the stored recording; no sensor starts. */
export function useRecoveredRun(ready: boolean) {
  const router = useRouter();
  const unitSystem = useUnitSystem();
  const insideApp = useSegments()[0] === '(tabs)';

  // biome-ignore lint/correctness/useExhaustiveDependencies: the unit system at launch is the one to speak in
  useEffect(() => {
    if (!ready || !insideApp || asked) return;
    asked = true;
    void (async () => {
      try {
        const blob = await getPlatform().storage.getItem(TRACKING_STORAGE_KEY);
        // The Record tab may already have picked the run up on its own; nothing to announce then.
        if (trackingSession.getSnapshot().status !== 'idle') return;
        const run = describeRecoverableRun(blob, Date.now(), unitSystem);
        if (!run) return;
        const open = (recover?: RecoveryChoice) =>
          router.push({ pathname: '/(tabs)/tracking', params: recover ? { recover } : {} });
        Alert.alert(run.stale ? 'Unfinished run found' : 'Run recovered', run.text, [
          { text: 'Resume', onPress: () => open() },
          // Too short to keep, so saving would only lead to the discard prompt.
          ...(run.tooShort ? [] : [{ text: 'Save', onPress: () => open('save') }]),
          { text: 'Discard', style: 'destructive', onPress: () => open('discard') },
        ]);
      } catch (error) {
        logger.warn('[Recovery] Could not read the stored run', error);
      }
    })();
  }, [ready, insideApp]);
}
