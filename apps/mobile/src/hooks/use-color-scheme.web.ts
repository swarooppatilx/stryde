import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/** Re-evaluated on the client so static rendering picks up the real scheme. */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
