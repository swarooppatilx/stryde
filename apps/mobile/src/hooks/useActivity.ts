import { services } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Svg from 'react-native-svg';
import { useShallow } from 'zustand/shallow';
import { createSharedActivityChain } from '@/services/activityChain';
import { deleteActivity as removeActivity } from '@/services/activityDeletion';
import { type ActivityEdit, editActivity } from '@/services/editActivity';
import { type ElevationData, getElevationForRoute } from '@/services/elevationService';
import { ipfsPhotoUploader } from '@/services/ipfsService';
import { useActivityStore } from '@/stores/activityStore';
import { activityKey, useSocialStore } from '@/stores/socialStore';
import type { Activity, Ring } from '@/types';
import { activityExportFile, type ExportFormat } from '@/utils/activityExport';
import { sameAddress } from '@/utils/address';
import { Alert } from '@/utils/alert';
import { elevationProfile } from '@/utils/elevation';
import { parsePolyline } from '@/utils/format';
import { logger } from '@/utils/logger';
import { polylineFromMetadata } from '@/utils/route';
import { copyRouteImage, saveRouteImage, shareExportFile, shareRouteImage } from '@/utils/share';
import { Toast } from '@/utils/toast';
import { useCurrentUserId } from './useCurrentUserId';
import { useViemWallet } from './useViemWallet';

export function useActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getActivityById = useActivityStore((s) => s.getActivityById);
  const updateActivity = useActivityStore((s) => s.updateActivity);
  const { socialActivities, updateSocialActivity } = useSocialStore(
    useShallow((s) => ({
      socialActivities: s.activities,
      updateSocialActivity: s.updateActivity,
    }))
  );
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const { wallet, address } = useViemWallet();
  const [fetchedElevation, setElevationData] = useState<ElevationData | null>(null);
  const svgRef = useRef<Svg>(null);

  const activity: Activity | undefined = id
    ? (getActivityById(id) ?? socialActivities[activityKey(socialActivities, id)])
    : undefined;

  // A chain-seeded activity carries only its metadata CID; fetch route and territory from IPFS. The store `polyline` stays authoritative.
  const [hydrated, setHydrated] = useState<{ polyline: string; territory?: Ring | null } | null>(
    null
  );
  const metadataCid = activity?.polyline ? undefined : activity?.metadataCid;
  useEffect(() => {
    setHydrated(null);
    if (!metadataCid) return;
    let cancelled = false;
    services.ipfs
      .fetchJsonFromIpfs<{ polyline?: string; coordinates?: unknown; territory?: Ring | null }>(
        metadataCid
      )
      .then((metadata) => {
        if (cancelled) return;
        setHydrated({
          polyline: polylineFromMetadata(metadata),
          territory: metadata?.territory,
        });
      })
      .catch((error) => {
        logger.warn('[useActivity] Failed to hydrate route from IPFS', error);
      });
    return () => {
      cancelled = true;
    };
  }, [metadataCid]);

  // A post opened from the feed belongs to someone else: no editing, no deleting.
  const me = useCurrentUserId();
  const isOwner = Boolean(
    activity && (getActivityById(activity.id) || sameAddress(activity.userId, me))
  );

  const effectivePolyline = activity?.polyline || hydrated?.polyline || '';
  const coordinates = useMemo(
    () => (effectivePolyline ? parsePolyline(effectivePolyline) : []),
    [effectivePolyline]
  );
  // The store record's own territory when it has one, else the ring from the
  // same IPFS metadata the route came from.
  const territory = activity?.territory ?? hydrated?.territory ?? null;

  // The altitudes saved with the recording need no network; only older activities ask the service.
  const savedElevation = useMemo(
    () => elevationProfile(activity?.stream, activity?.elevationGain, activity?.elevationLoss),
    [activity?.stream, activity?.elevationGain, activity?.elevationLoss]
  );
  const hasSavedElevation = savedElevation !== null;
  const elevationData: ElevationData | null = savedElevation ?? fetchedElevation;

  useEffect(() => {
    if (coordinates.length <= 1 || hasSavedElevation) return;
    let cancelled = false;
    getElevationForRoute(coordinates)
      .then((data) => {
        if (!cancelled) setElevationData(data);
      })
      .catch((error) => {
        logger.error('[useActivity] Failed to load elevation', error);
      });
    return () => {
      cancelled = true;
    };
  }, [coordinates, hasSavedElevation]);

  useEffect(() => {
    // Elevation gain is computed here and stored nowhere else; feed and history read `Activity.elevationGain`.
    if (!elevationData || !activity) return;
    if (activity.elevationGain != null) return;
    if (!getActivityById(activity.id)) return; // someone else's activity, cached locally
    updateActivity(activity.id, { elevationGain: elevationData.totalAscent });
  }, [elevationData, activity, getActivityById, updateActivity]);

  const deleteActivityFlow = useCallback(() => {
    if (!activity) return;
    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete "${activity.name || 'Activity'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeActivity(activity.id);
            Toast.success('Activity deleted', 1.5);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }, [activity, router]);

  const startEditName = useCallback(() => {
    if (!activity || !isOwner) return;
    setEditedName(activity.name || '');
    setIsEditingName(true);
  }, [activity, isOwner]);

  /** Saves an edit here at once and republishes it for others when the activity is onchain. */
  const saveEdit = useCallback(
    async (edit: ActivityEdit) => {
      if (!activity) return;
      const local = Boolean(getActivityById(activity.id));
      let result: Awaited<ReturnType<typeof editActivity>>;
      try {
        result = await editActivity(
          {
            store: { updateActivity: local ? updateActivity : updateSocialActivity },
            chain: wallet && address ? createSharedActivityChain(wallet, address) : null,
            uploader: ipfsPhotoUploader,
          },
          activity,
          edit
        );
      } catch (error) {
        logger.warn('[Activity] Edit failed', error);
        Toast.fail("Couldn't save that change", 2);
        return;
      }
      if (result.published) Toast.success('Updated', 1.2);
      else if (result.reason === 'failed') {
        Toast.info("Saved here, but couldn't update it for others yet", 3);
      }
    },
    [activity, getActivityById, updateActivity, updateSocialActivity, wallet, address]
  );

  const saveName = useCallback(() => {
    // Blur and the keyboard's submit both land here; the second one finds nothing left to save.
    if (!isEditingName) return;
    setIsEditingName(false);
    void saveEdit({ name: editedName });
  }, [editedName, isEditingName, saveEdit]);

  const startEditDescription = useCallback(() => {
    if (isOwner) setDescriptionDraft(activity?.description ?? '');
  }, [activity, isOwner]);

  const saveDescription = useCallback(() => {
    if (descriptionDraft !== null) void saveEdit({ description: descriptionDraft });
    setDescriptionDraft(null);
  }, [descriptionDraft, saveEdit]);

  const cancelEditDescription = useCallback(() => setDescriptionDraft(null), []);

  const share = useCallback(async () => {
    if (!activity) return;
    await shareRouteImage(svgRef, activity.id);
  }, [activity]);

  const exportActivity = useCallback(
    async (format: ExportFormat) => {
      if (!activity) return;
      // Elevations are absent until the DEM lookup lands, which just means a track without altitude.
      const file = activityExportFile(format, activity, coordinates, elevationData?.elevations);
      if (file) await shareExportFile(activity.name || activity.id, file);
    },
    [activity, coordinates, elevationData]
  );

  const copy = useCallback(async () => {
    await copyRouteImage(svgRef);
  }, []);

  const download = useCallback(async () => {
    await saveRouteImage(svgRef);
  }, []);

  // Back to wherever the athlete came from (profile, feed); home only when there is nowhere to go back to.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const goHome = useCallback(() => router.replace('/(tabs)'), [router]);

  /** Which shoes or bike the athlete used; kept on this device only, so it never goes onchain. */
  const setGear = useCallback(
    (gearId: string | null) => {
      if (!activity) return;
      const local = Boolean(getActivityById(activity.id));
      (local ? updateActivity : updateSocialActivity)(activity.id, {
        gearId: gearId ?? undefined,
      });
    },
    [activity, getActivityById, updateActivity, updateSocialActivity]
  );

  const savePhotos = useCallback((photos: string[]) => void saveEdit({ photos }), [saveEdit]);

  return {
    savePhotos,
    setGear,
    activity,
    coordinates,
    territory,
    isEditingName,
    editedName,
    setEditedName,
    elevationData,
    svgRef,
    handleDelete: deleteActivityFlow,
    handleStartEditName: startEditName,
    handleSaveName: saveName,
    descriptionDraft,
    setDescriptionDraft,
    handleStartEditDescription: startEditDescription,
    handleSaveDescription: saveDescription,
    handleCancelEditDescription: cancelEditDescription,
    handleShare: share,
    handleExport: exportActivity,
    handleCopy: copy,
    handleDownload: download,
    goBack,
    goHome,
    isOwner,
  };
}
