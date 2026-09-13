import { File, Paths } from 'expo-file-system';
import type { RefObject } from 'react';
import Share from 'react-native-share';
import type Svg from 'react-native-svg';

import { ENV } from '@/constants/config';
import { Alert } from '@/utils/alert';
import { Toast } from '@/utils/toast';
import { buildActivityDeepLink } from './deepLink';

type SvgRef = RefObject<Svg | null>;

const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_HEIGHT = 1920;

// Rendering straight from the SVG source via toDataURL() rasterizes with a
// real alpha channel — a react-native-view-shot screenshot of the same
// content loses transparency on Android even when every layer is
// transparent, which breaks the "Instagram sticker" use case this image is
// for.
function renderPngBase64(svgRef: SvgRef): Promise<string> {
  return new Promise((resolve, reject) => {
    const svg = svgRef.current;
    if (!svg) {
      reject(new Error('Route image is not ready yet.'));
      return;
    }
    svg.toDataURL(
      (base64) => {
        if (base64) resolve(base64);
        else reject(new Error('Failed to render route image.'));
      },
      { width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT }
    );
  });
}

function writeTempPng(base64: string): string {
  const file = new File(Paths.cache, `stryde-route-${Date.now()}.png`);
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

function buildShareMessage(activityId?: string): string | undefined {
  if (!activityId) return undefined;
  return `Check out my activity on ${ENV.APP_NAME}: ${buildActivityDeepLink(activityId)}`;
}

/** Opens the OS share sheet with the transparent stat-card PNG. Any app that
 * accepts an image can be picked, including Instagram — which recognizes a
 * transparent PNG shared to it as story-sticker content. */
export async function shareRouteImage(svgRef: SvgRef, activityId?: string): Promise<void> {
  try {
    const base64 = await renderPngBase64(svgRef);
    const uri = writeTempPng(base64);

    await Share.open({
      url: uri,
      type: 'image/png',
      message: buildShareMessage(activityId),
      failOnCancel: false,
    });
  } catch (error) {
    console.warn('[shareRouteImage] Failed to render or share', error);
    Alert.alert('Share', 'Failed to generate route image.');
  }
}

export async function copyRouteImage(svgRef: SvgRef): Promise<void> {
  try {
    const base64 = await renderPngBase64(svgRef);
    // Lazy import — keeps this rarely-hit path off the module's initial load.
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setImageAsync(base64);
    Toast.success('Image copied', 1);
  } catch (error) {
    console.warn('[copyRouteImage] Failed to render or copy', error);
    Alert.alert('Copy', 'Failed to copy route image.');
  }
}

export async function saveRouteImage(svgRef: SvgRef): Promise<void> {
  try {
    // Lazy import — native module may be absent until dev client is rebuilt.
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to save route images to your device.'
      );
      return;
    }

    const base64 = await renderPngBase64(svgRef);
    const uri = writeTempPng(base64);
    await MediaLibrary.Asset.create(uri);
    Toast.success('Saved to Photos', 1);
  } catch (error) {
    console.warn('[saveRouteImage] Failed to render or save', error);
    Alert.alert('Save', 'Failed to save route image.');
  }
}
