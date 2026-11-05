import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { ignoreFailure } from '@/utils/ignoreFailure';
import { shouldReduceMotion } from '@/utils/motionPreference';

/** Whether animation should be kept to a minimum: the phone asks for it, or the athlete chose Reduced. */
export function useReduceMotion(): boolean {
  const preference = useSettingsStore((s) => s.motion);
  const [system, setSystem] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setSystem(enabled);
      })
      .catch(ignoreFailure);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return shouldReduceMotion(preference, system);
}
