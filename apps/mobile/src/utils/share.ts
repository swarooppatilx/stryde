import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Alert, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function shareRouteImage(viewRef: RefObject<View | null>): Promise<void> {
  if (!viewRef.current) {
    Alert.alert('Share', 'Unable to generate route image.');
    return;
  }

  try {
    await delay(100);

    const uri = await captureRef(viewRef, {
      format: 'png',
      result: 'tmpfile',
      width: 1080,
      height: 1080,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Share', 'Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share route',
    });
  } catch (error) {
    console.warn('[shareRouteImage] Failed to capture or share', error);
    Alert.alert('Share', 'Failed to generate route image.');
  }
}
