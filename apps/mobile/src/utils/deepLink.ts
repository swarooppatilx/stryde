import * as Linking from 'expo-linking';

export function buildActivityDeepLink(activityId: string): string {
  return Linking.createURL('activity-summary', { queryParams: { id: activityId } });
}
