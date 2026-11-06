import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Takes over the phone's back button while this screen is in front: `onBack` runs instead of the
 * default back, which is swallowed. It is dropped as soon as another screen covers this one (a tab
 * stays mounted underneath, and a stale handler there would answer for the screen on top), and
 * `enabled` false hands the button back. The latest `onBack` is always the one that runs.
 */
export function useBackHandler(onBack: () => void, enabled = true): void {
  const latest = useRef(onBack);
  latest.current = onBack;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        latest.current();
        return true;
      });
      return () => subscription.remove();
    }, [enabled])
  );
}
