import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, type View } from 'react-native';

import { type ElevationData, getElevationForRoute } from '@/services/elevationService';
import { useActivityStore } from '@/stores/activityStore';
import { useSocialStore } from '@/stores/socialStore';
import type { Activity } from '@/types';
import { parsePolyline } from '@/utils/format';
import { shareRouteImage } from '@/utils/share';

export function useActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getActivityById, deleteActivity, updateActivity } = useActivityStore();
  const socialActivities = useSocialStore((s) => s.activities);
  const router = useRouter();
  const [coordinates, setCoordinates] = useState<[number, number][]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [elevationData, setElevationData] = useState<ElevationData | null>(null);
  const viewRef = useRef<View>(null);

  const activity: Activity | undefined = id
    ? (getActivityById(id) ?? (socialActivities.find((a) => a.id === id) as Activity | undefined))
    : undefined;

  useEffect(() => {
    if (activity?.polyline) {
      setCoordinates(parsePolyline(activity.polyline));
    }
  }, [activity?.polyline]);

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

  const deleteActivityFlow = () => {
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
  };

  const startEditName = () => {
    if (!activity) return;
    setEditedName(activity.name || '');
    setIsEditingName(true);
  };

  const saveName = () => {
    const trimmed = editedName.trim();
    if (trimmed.length > 0 && activity) {
      updateActivity(activity.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const share = async () => {
    if (!activity) return;
    await shareRouteImage(viewRef);
  };

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
    goBack: () => router.replace('/(tabs)'),
  };
}
