import { getPlatform } from '@/platform';
import { discardInFlightRun } from '@/services/discardInFlightRun';
import { trackingSession } from '@/services/trackingSession';
import { useActivityStore } from '@/stores/activityStore';
import { useBlockStore } from '@/stores/blockStore';
import { useBodyStore } from '@/stores/bodyStore';
import { useCommunityStore } from '@/stores/communityStore';
import { useFeedPrefsStore } from '@/stores/feedPrefsStore';
import { useGearStore } from '@/stores/gearStore';
import { useGoalsStore } from '@/stores/goalsStore';
import { useHealthStore } from '@/stores/healthStore';
import { useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useNotificationPrefsStore } from '@/stores/notificationPrefsStore';
import { usePostStore } from '@/stores/postStore';
import { useProfileStore } from '@/stores/profileStore';
import { useRecentSearchStore } from '@/stores/recentSearchStore';
import { useRecordUiStore } from '@/stores/recordUiStore';
import { useRouteStore } from '@/stores/routeStore';
import { useSegmentStarsStore } from '@/stores/segmentStarsStore';
import { useSensorStore } from '@/stores/sensorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSocialStore } from '@/stores/socialStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { useToastStore } from '@/stores/toastStore';
import { useWithdrawnStore } from '@/stores/withdrawnStore';
import { useWorldVerificationStore } from '@/stores/worldVerificationStore';

/**
 * Wipes everything the signed-out account kept on this device. The stores persist per chain, not per
 * account, so without this the next person to sign in would inherit the last one's gear, saved
 * routes, blocked athletes and settings.
 */
export function resetAccountStores(): void {
  // An unfinished recording belongs to the account too; callers that can wait use discardInFlightRun.
  void discardInFlightRun(getPlatform().storage, trackingSession);
  useProfileStore.getState().reset();
  useActivityStore.getState().reset();
  usePostStore.getState().reset();
  useTerritoryStore.getState().reset();
  useSocialStore.getState().reset();
  useCommunityStore.getState().reset();
  useGearStore.getState().reset();
  useGoalsStore.getState().reset();
  useHealthStore.getState().reset();
  useBodyStore.getState().reset();
  useRouteStore.getState().reset();
  useBlockStore.getState().reset();
  useSegmentStarsStore.getState().reset();
  useSensorStore.getState().reset();
  useFeedPrefsStore.getState().reset();
  useMapPrefsStore.getState().reset();
  useRecordUiStore.getState().reset();
  useRecentSearchStore.getState().clear();
  useSettingsStore.getState().reset();
  useNotificationPrefsStore.getState().reset();
  useWorldVerificationStore.getState().reset();
  useWithdrawnStore.getState().reset();
  useToastStore.getState().reset();
}
