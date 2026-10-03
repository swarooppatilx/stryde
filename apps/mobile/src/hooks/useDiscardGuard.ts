import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { confirmDiscard } from '@/utils/confirmDiscard';

/** Asks "Discard changes?" when a form with unsaved input is left by any route; call `allowLeave()` just before an intentional exit (after save). */
export function useDiscardGuard(dirty: boolean): { allowLeave: () => void } {
  const navigation = useNavigation();
  const allowed = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirty || allowed.current) return;
        event.preventDefault();
        confirmDiscard(() => navigation.dispatch(event.data.action));
      }),
    [navigation, dirty]
  );
  const allowLeave = useCallback(() => {
    allowed.current = true;
  }, []);
  return { allowLeave };
}
