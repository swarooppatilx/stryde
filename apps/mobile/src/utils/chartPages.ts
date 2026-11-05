import type { ActivityStream, ActivityType } from '@/types';
import { plausibleStreamSpeeds } from './activityStream';
import { nearestIndex } from './chartScrub';

export type ChartPage = 'pace' | 'elevation' | 'heartRate';

export interface ElevationSeries {
  /** Metres above sea level. */
  values: number[];
  /** Ascending positions along the chart: seconds for a stream's altitude, point numbers for a lookup. */
  times: number[];
  source: 'stream' | 'service';
}

/** The altitude recorded with the stream when it lines up with it, else the lookup along the route. */
export function elevationSeries(
  stream: ActivityStream | undefined,
  lookup: readonly number[] | undefined
): ElevationSeries | null {
  if (stream?.alt && stream.alt.length >= 2 && stream.alt.length === stream.t.length) {
    return { values: stream.alt, times: stream.t, source: 'stream' };
  }
  if (lookup && lookup.length >= 2) {
    return { values: [...lookup], times: lookup.map((_, i) => i), source: 'service' };
  }
  return null;
}

/** The charts there is data for, in swipe order. */
export function chartPages({
  stream,
  elevations,
  activityType,
}: {
  stream: ActivityStream | undefined;
  elevations?: readonly number[];
  activityType: ActivityType;
}): ChartPage[] {
  const pages: ChartPage[] = [];
  if (
    stream &&
    stream.t.length >= 2 &&
    Math.max(...plausibleStreamSpeeds(stream.speed, activityType), 0) > 0
  ) {
    pages.push('pace');
  }
  if (elevationSeries(stream, elevations)) pages.push('elevation');
  if (stream?.heartRate && stream.heartRate.bpm.length >= 2) pages.push('heartRate');
  return pages;
}

/** The stream point to mark on the map for a point of the elevation chart; null when there is none to mark. */
export function elevationScrubTarget(
  series: ElevationSeries | null,
  index: number | null,
  stream: ActivityStream | undefined
): number | null {
  if (!series || index === null) return null;
  if (series.source === 'stream') return index;
  const distances = stream?.d;
  const total = distances?.at(-1) ?? 0;
  if (!distances || total <= 0) return null;
  return nearestIndex(distances, (index / (series.values.length - 1)) * total);
}

/** The stream point nearest in time to a heart-rate reading. */
export function heartRateScrubTarget(
  stream: ActivityStream | undefined,
  index: number | null
): number | null {
  const seconds = index === null ? undefined : stream?.heartRate?.t[index];
  return seconds === undefined || !stream ? null : nearestIndex(stream.t, seconds);
}
