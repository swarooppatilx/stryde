import { useCallback } from 'react';
import { getPlatform } from '@/platform';
import { Alert } from '@/utils/alert';
import { haptics } from '@/utils/haptics';

export const MAX_PHOTOS = 4;

/** Opens the photo library and returns the list with picks added up to the limit; shared so access prompts and the count cap are identical. */
export function usePhotoPick(
  photos: readonly string[],
  onPhotosChange: (photos: string[]) => void,
  maxPhotos = MAX_PHOTOS
) {
  return useCallback(async () => {
    haptics.tap();
    const result = await getPlatform().photos.pick({
      multiple: true,
      limit: maxPhotos - photos.length,
    });
    if (result.status === 'denied') {
      Alert.alert(
        'Permission needed',
        'Photo library access is required to add photos to your activity.'
      );
      return;
    }
    if (result.uris.length > 0) {
      onPhotosChange([...photos, ...result.uris].slice(0, maxPhotos));
    }
  }, [photos, onPhotosChange, maxPhotos]);
}
