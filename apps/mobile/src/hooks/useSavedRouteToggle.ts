import { getSportLabel } from '@/constants/activity';
import { useRouteStore } from '@/stores/routeStore';
import type { Activity } from '@/types';
import { haptics } from '@/utils/haptics';
import { Toast } from '@/utils/toast';

/** Whether the activity's route is in the athlete's saved routes, and a toggle that saves or removes it. */
export function useSavedRouteToggle(activity: Activity | undefined) {
  const savedRoutes = useRouteStore((s) => s.routes);
  const saved = savedRoutes.find((r) => r.polyline === activity?.polyline);
  const toggle = () => {
    if (!activity) return;
    const { save, remove } = useRouteStore.getState();
    if (saved) {
      remove(saved.id);
      Toast.info('Removed from saved routes', 1);
      return;
    }
    save({
      name: activity.name || getSportLabel(activity.activityType),
      polyline: activity.polyline,
      distance: activity.distance,
      sport: activity.activityType,
      elevationGain: activity.elevationGain,
      duration: activity.duration,
    });
    haptics.success();
    Toast.success('Saved. Find it on the Maps tab', 1.5);
  };
  return { routeSaved: saved !== undefined, toggleSavedRoute: toggle };
}
