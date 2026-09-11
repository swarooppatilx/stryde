import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type View } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { type ElevationData, getElevationForRoute } from '@/services/elevationService';
import { useActivityStore } from '@/stores/activityStore';
import { useSocialStore } from '@/stores/socialStore';
import type { Activity } from '@/types';
import { parsePolyline } from '@/utils/format';
import { shareRouteImage } from '@/utils/share';

export function useActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getActivityById = useActivityStore((s) => s.getActivityById);
  const deleteActivity = useActivityStore((s) => s.deleteActivity);
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
  const [elevationData, setElevationData] = useState<ElevationData | null>(null);
  const viewRef = useRef<View>(null);

  const activity: Activity | undefined = id
    ? (getActivityById(id) ?? socialActivities[id.toLowerCase()])
    : undefined;

  const coordinates = useMemo(
    () => (activity?.polyline ? parsePolyline(activity.polyline) : []),
    [activity?.polyline]
  );

  useEffect(() => {
    if (coordinates.length <= 1) return;
    let cancelled = false;
    getElevationForRoute(coordinates)
      .then((data) => {
        if (!cancelled) setElevationData(data);
      })
      .catch((error) => {
        console.error('[useActivity] Failed to load elevation', error);
      });
    return () => {
      cancelled = true;
    };
  }, [coordinates]);

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
            deleteActivity(activity.id);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }, [activity, deleteActivity, router]);

  const startEditName = useCallback(() => {
    if (!activity) return;
    setEditedName(activity.name || '');
    setIsEditingName(true);
  }, [activity]);

  const saveName = useCallback(() => {
    const trimmed = editedName.trim();
    if (trimmed.length > 0 && activity) {
      const inActivityStore = getActivityById(activity.id);
      if (inActivityStore) {
        updateActivity(activity.id, { name: trimmed });
      } else {
        updateSocialActivity(activity.id, { name: trimmed });
      }
    }
    setIsEditingName(false);
  }, [editedName, activity, getActivityById, updateActivity, updateSocialActivity]);

  const share = useCallback(async () => {
    if (!activity) return;
    await shareRouteImage(viewRef, activity.id);
  }, [activity]);

  const goBack = useCallback(() => router.replace('/(tabs)'), [router]);

  return {
    activity,
    coordinates,
    isEditingName,
    editedName,
    setEditedName,
    elevationData,
    viewRef,
    handleDelete: deleteActivityFlow,
    handleStartEditName: startEditName,
    handleSaveName: saveName,
    handleShare: share,
    goBack,
  };
}
