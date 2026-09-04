import type { Ionicons } from '@expo/vector-icons';

import type { ActivityType } from '@/types';

export const SPORT_ICONS: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  run: 'walk',
  ride: 'bicycle',
  walk: 'footsteps',
  hike: 'leaf',
};

export function getSportIcon(type: ActivityType | undefined): keyof typeof Ionicons.glyphMap {
  return (type && SPORT_ICONS[type]) || 'walk';
}
