import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from '@/utils/alert';
import { restoreRecordedRuns } from '@/utils/recordedRunHandoff';

// Once per launch: asking again on every Home visit would nag someone who chose "Not now".
let asked = false;

/** After the app was killed on the Save screen, offers the finished run that never got saved. */
export function useUnsavedRunPrompt(): void {
  const router = useRouter();
  useEffect(() => {
    if (asked) return;
    asked = true;
    void restoreRecordedRuns().then((id) => {
      if (!id) return;
      Alert.alert('Finish saving your run?', 'Your last run was recorded but never saved.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Review and save',
          onPress: () => router.push({ pathname: '/create-activity', params: { run: id } }),
        },
      ]);
    });
  }, [router]);
}
