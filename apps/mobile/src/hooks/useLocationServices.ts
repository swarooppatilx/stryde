import { useEffect, useState } from 'react';
import { getPlatform } from '@/platform';
import { logger } from '@/utils/logger';

const CHECK_EVERY_MS = 3000;

export interface LocationReadiness {
  servicesOn: boolean;
  permitted: boolean;
}

/** Whether location can work, polled while `active` (services can be enabled from the notification shade). Assumed fine until the phone says otherwise so start-up never flashes a warning. */
export function useLocationServices(active: boolean): LocationReadiness {
  const [state, setState] = useState<LocationReadiness>({ servicesOn: true, permitted: true });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const check = () => {
      const { location } = getPlatform();
      Promise.all([location.servicesEnabled(), location.getPermission()])
        .then(([servicesOn, permission]) => {
          if (cancelled) return;
          // Approximate-only access cannot record a route, so it counts as not allowed yet.
          const permitted = permission.granted && permission.precise !== false;
          setState((current) =>
            current.servicesOn === servicesOn && current.permitted === permitted
              ? current
              : { servicesOn, permitted }
          );
        })
        .catch((error) => logger.warn('[LocationServices] Status check failed', error));
    };
    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);
  return state;
}
