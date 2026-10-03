import type { MapChip } from '@/components/map-chips';

interface Handlers {
  hide(): void;
  openDetails(): void;
  plan(): void;
}

/** Route chips that lead the Map tab's row: a way out of a preview and into its page, and the route planner. */
export function routeChips(previewing: boolean, { hide, openDetails, plan }: Handlers): MapChip[] {
  return [
    ...(previewing
      ? [
          { key: 'route', label: 'Hide route', active: true, onPress: hide },
          { key: 'route-details', label: 'Route details', active: false, onPress: openDetails },
        ]
      : []),
    { key: 'plan', label: 'Plan a route', active: false, onPress: plan },
  ];
}
