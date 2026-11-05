import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { type SavedRoute, useRouteStore } from '@/stores/routeStore';

/** The saved route drawn on the Map tab: picked from the sheet, or opened by a `route` link from its detail page. */
export function useRoutePreview() {
  const { route: routeParam } = useLocalSearchParams<{ route?: string }>();
  const [chosen, setChosen] = useState<SavedRoute | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const fromLink = useRouteStore((s) => s.routes.find((r) => r.id === routeParam));
  const linked = fromLink && dismissed !== fromLink.id ? fromLink : null;
  const preview = chosen ?? linked;

  return {
    preview,
    setPreview: setChosen,
    hide: () => {
      setChosen(null);
      if (preview) setDismissed(preview.id);
    },
  };
}
