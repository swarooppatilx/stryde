import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { getPlatform } from '@/platform';
import { type ReadinessCheck, readinessChecks, readinessRows, readOrNull } from '@/utils/readiness';

const CHECK_EVERY_MS = 3000;

/** The "Before you start" rows, polled while focused and `active` and refreshed on focus. Empty until the phone answers and when nothing is wrong; a failed read counts as unknown and never warns. */
export function usePreRunReadiness(active: boolean): ReadinessCheck[] {
  const [rows, setRows] = useState<ReadinessCheck[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      let cancelled = false;
      const check = async () => {
        const { location, readiness } = getPlatform();
        const [permission, servicesOn, backgroundLocation, notifications, freeStorageBytes] =
          await Promise.all([
            readOrNull(() => location.getPermission()),
            readOrNull(() => location.servicesEnabled()),
            readOrNull(() => readiness.backgroundLocationAllowed()),
            readOrNull(() => readiness.notificationsAllowed()),
            readOrNull(() => readiness.freeStorageBytes()),
          ]);
        if (cancelled) return;
        const next = readinessRows(
          readinessChecks({
            location: permission,
            backgroundLocation,
            servicesOn,
            notifications,
            freeStorageBytes,
          })
        );
        setRows((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
      };
      const run = () => void check();
      run();
      const id = setInterval(run, CHECK_EVERY_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [active])
  );
  return rows;
}
