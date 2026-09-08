import type { RefObject } from 'react';
import { Alert, type View } from 'react-native';
import Share, { Social } from 'react-native-share';
import { captureRef } from 'react-native-view-shot';

import { ENV } from '@/constants/config';
import { buildActivityDeepLink } from './deepLink';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Facebook App ID required by react-native-share to attribute Instagram
// Stories shares. Not currently provisioned anywhere else in this app —
// set EXPO_PUBLIC_FACEBOOK_APP_ID to enable shareToInstagramStories.
const SOCIAL_SHARE_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '';

function buildShareMessage(activityId?: string): string | undefined {
  if (!activityId) return undefined;
  return `Check out my activity on ${ENV.APP_NAME}: ${buildActivityDeepLink(activityId)}`;
}

export async function shareRouteImage(
  viewRef: RefObject<View | null>,
  activityId?: string
): Promise<void> {
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

    await Share.open({
      url: uri,
      type: 'image/png',
      message: buildShareMessage(activityId),
      failOnCancel: false,
    });
  } catch (error) {
    console.warn('[shareRouteImage] Failed to capture or share', error);
    Alert.alert('Share', 'Failed to generate route image.');
  }
}

export async function shareToInstagramStories(
  viewRef: RefObject<View | null>,
  activityId?: string
): Promise<void> {
  if (!viewRef.current) {
    Alert.alert('Share', 'Unable to generate route image.');
    return;
  }

  if (!SOCIAL_SHARE_APP_ID) {
    Alert.alert('Share', 'Instagram Stories sharing is not configured for this app.');
    return;
  }

  try {
    await delay(100);

    const uri = await captureRef(viewRef, {
      format: 'png',
      result: 'tmpfile',
      width: 1080,
      height: 1920,
    });

    await Share.shareSingle({
      social: Social.InstagramStories,
      appId: SOCIAL_SHARE_APP_ID,
      backgroundImage: uri,
      linkUrl: activityId ? buildActivityDeepLink(activityId) : undefined,
    });
  } catch (error) {
    console.warn('[shareToInstagramStories] Failed to capture or share', error);
    Alert.alert('Share', 'Failed to share to Instagram Stories.');
  }
}
