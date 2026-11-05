import { useEffect, useState } from 'react';
import { whenProfileReady } from '@/backends/activeProfile';
import { configureBackends } from '@/backends/configure';

/** False until the developer profile is loaded and the backends are pointed at it. */
export function useProfileReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void whenProfileReady().then(() => {
      if (!mounted) return;
      configureBackends();
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return ready;
}
