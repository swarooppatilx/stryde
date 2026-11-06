import type { Activity } from '@/types';
import { bytesToBase64 } from '@/utils/base64';
import { exportFit } from '@/utils/exportFit';
import { exportTcx } from '@/utils/exportTcx';
import { buildExportTrack } from '@/utils/exportTrack';
import { toGpx } from '@/utils/gpx';
import { routeTimes } from '@/utils/routeTimes';

export type ExportFormat = 'gpx' | 'tcx' | 'fit';

export interface ExportFile {
  extension: ExportFormat;
  mime: string;
  content: string;
  encoding: 'utf8' | 'base64';
}

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  gpx: 'GPX (any app)',
  tcx: 'TCX (heart rate, laps)',
  fit: 'FIT (watches, training apps)',
};

type Source = Pick<
  Activity,
  'name' | 'activityType' | 'distance' | 'duration' | 'stream' | 'laps' | 'createdAt'
>;

/** The activity's route as a file in the chosen format; null when there is no line to write. */
export function activityExportFile(
  format: ExportFormat,
  activity: Source,
  route: readonly [number, number][],
  elevations?: readonly number[]
): ExportFile | null {
  if (format === 'gpx') {
    const gpx = toGpx({
      name: activity.name || 'Activity',
      activityType: activity.activityType,
      startedAt: new Date(activity.stream?.startedAt ?? activity.createdAt),
      route,
      elevations,
      times:
        (activity.stream && routeTimes(route as [number, number][], activity.stream)) || undefined,
    });
    return gpx === null
      ? null
      : { extension: 'gpx', mime: 'application/gpx+xml', content: gpx, encoding: 'utf8' };
  }
  const track = buildExportTrack(activity, route, elevations);
  if (!track) return null;
  if (format === 'tcx') {
    return {
      extension: 'tcx',
      mime: 'application/vnd.garmin.tcx+xml',
      content: exportTcx(track),
      encoding: 'utf8',
    };
  }
  return {
    extension: 'fit',
    mime: 'application/vnd.ant.fit',
    content: bytesToBase64(exportFit(track)),
    encoding: 'base64',
  };
}
