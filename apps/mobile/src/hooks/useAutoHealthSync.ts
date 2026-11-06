import { useEffect } from 'react';
import { AppState } from 'react-native';
import { autoSyncOnce } from '@/services/healthSync';
import { usePostRun } from './usePostRun';

/** Checks for new health-data workouts when the app opens or returns to the front, if turned on. */
export function useAutoHealthSync(active: boolean) {
  const { save } = usePostRun();
  useEffect(() => {
    if (!active) return;
    const run = () => void autoSyncOnce(save);
    run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => sub.remove();
  }, [active, save]);
}
