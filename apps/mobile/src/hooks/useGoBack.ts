import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { goBackOrHome } from '@/utils/goBackOrHome';

/** A back action for a screen's close or back button that always leads somewhere. */
export function useGoBack(): () => void {
  const router = useRouter();
  return useCallback(() => goBackOrHome(router), [router]);
}
