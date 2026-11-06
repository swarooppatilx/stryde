import type { RefObject } from 'react';
import Share from 'react-native-share';
import type Svg from 'react-native-svg';

import { ENV } from '@/constants/config';
import { getPlatform } from '@/platform';
import type { ExportFile } from '@/utils/activityExport';
import { Alert } from '@/utils/alert';
import { bytesToBase64 } from '@/utils/base64';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';
import { TRACE_FOLDER } from '@/utils/trackingTrace';
import { buildActivityDeepLink } from './deepLink';

type SvgRef = RefObject<Svg | null>;

const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_HEIGHT = 1920;

// Rendering from the SVG source via toDataURL() keeps a real alpha channel; a view-shot screenshot loses transparency on Android, which breaks the sticker use case.
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
  const { clock, files } = getPlatform();
  return files.writeCache(`stryde-route-${clock.now()}.png`, base64, 'base64');
}

function buildShareMessage(activityId?: string): string | undefined {
  if (!activityId) return undefined;
  return `Check out my activity on ${ENV.APP_NAME}: ${buildActivityDeepLink(activityId)}`;
}

/** Runs a share or export step; if it throws, logs it and tells the athlete with one alert. */
async function withFailureAlert(
  title: string,
  message: string,
  run: () => Promise<void>
): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.warn(`[share] ${message}`, error);
    Alert.alert(title, message);
  }
}

/** Opens the OS share sheet with the transparent stat-card PNG; apps that treat a transparent PNG as a story sticker (e.g. Instagram) recognize it. */
export function shareRouteImage(svgRef: SvgRef, activityId?: string): Promise<void> {
  return withFailureAlert('Share', 'Failed to generate route image.', async () => {
    const base64 = await renderPngBase64(svgRef);
    const uri = writeTempPng(base64);

    await Share.open({
      url: uri,
      type: 'image/png',
      message: buildShareMessage(activityId),
      failOnCancel: false,
    });
  });
}

const fileStemOf = (stem: string) =>
  stem.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 60) || 'activity';

/** Shares the route as a .gpx file, for any app that imports tracks. */
export function shareGpx(fileStem: string, gpx: string): Promise<void> {
  return shareExportFile(fileStem, {
    extension: 'gpx',
    mime: 'application/gpx+xml',
    content: gpx,
    encoding: 'utf8',
  });
}

/** Shares an activity file (GPX, TCX or FIT) through the system share sheet. */
export function shareExportFile(fileStem: string, file: ExportFile): Promise<void> {
  return withFailureAlert('Export', 'Could not export this route.', async () => {
    const filename = `${fileStemOf(fileStem)}.${file.extension}`;
    const uri = getPlatform().files.writeCache(filename, file.content, file.encoding);
    await Share.open({ url: uri, type: file.mime, filename, failOnCancel: false });
  });
}

/** Shares a ZIP of activity files through the system share sheet. */
export function shareZip(fileStem: string, zip: Uint8Array): Promise<void> {
  return withFailureAlert('Export', 'Could not export your activities.', async () => {
    const filename = `${fileStemOf(fileStem)}.zip`;
    const uri = getPlatform().files.writeCache(filename, bytesToBase64(zip), 'base64');
    await Share.open({ url: uri, type: 'application/zip', filename, failOnCancel: false });
  });
}

/** Offers the athlete's data export (JSON) to the system share sheet, so they can save or send it. */
export function shareDataExport(json: string): Promise<void> {
  return withFailureAlert('Export', 'Could not export your data.', async () => {
    const uri = getPlatform().files.writeCache('stryde-data-export.json', json);
    await Share.open({
      url: uri,
      type: 'application/json',
      filename: 'stryde-data-export.json',
      failOnCancel: false,
    });
  });
}

export function copyRouteImage(svgRef: SvgRef): Promise<void> {
  return withFailureAlert('Copy', 'Failed to copy route image.', async () => {
    const base64 = await renderPngBase64(svgRef);
    // Lazy import — keeps this rarely-hit path off the module's initial load.
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setImageAsync(base64);
    Toast.success('Image copied', 1);
  });
}

export function saveRouteImage(svgRef: SvgRef): Promise<void> {
  return withFailureAlert('Save', 'Failed to save route image.', async () => {
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
  });
}

/** Shares a line of text, such as a badge just earned, through the system share sheet. */
export function shareText(message: string): Promise<void> {
  return withFailureAlert('Share', 'Could not share this.', () =>
    Share.open({ message, failOnCancel: false }).then(() => undefined)
  );
}

/** Shares the newest live-tracking trace (newline-delimited JSON) for offline analysis. */
export function shareLatestTrackingTrace(): Promise<void> {
  return withFailureAlert('Share', 'Could not share the tracking trace.', async () => {
    const uri = getPlatform().files.listDocuments(TRACE_FOLDER).at(-1);
    if (!uri) {
      Toast.info('No tracking trace yet: record an activity first');
      return;
    }
    await Share.open({
      url: uri,
      type: 'text/plain',
      filename: uri.split('/').at(-1),
      failOnCancel: false,
    });
  });
}
