import type { Activity } from '@/types';
import { activityExportFile } from '@/utils/activityExport';
import { parsePolyline } from '@/utils/format';
import type { ZipEntry } from '@/utils/zipStore';

export type ExportRange = 'all' | '30d' | 'year' | 'lastYear';

export const EXPORT_RANGE_OPTIONS: ReadonlyArray<{ value: ExportRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
  { value: 'lastYear', label: 'Last year' },
];

const DAY_MS = 86_400_000;

/** The span of start times a range covers, in ms since 1970; open-ended at the top for "all". */
export function rangeBounds(range: ExportRange, now: Date): { from: number; to: number } {
  const year = now.getFullYear();
  switch (range) {
    case '30d':
      return { from: now.getTime() - 30 * DAY_MS, to: Number.POSITIVE_INFINITY };
    case 'year':
      return { from: new Date(year, 0, 1).getTime(), to: Number.POSITIVE_INFINITY };
    case 'lastYear':
      return { from: new Date(year - 1, 0, 1).getTime(), to: new Date(year, 0, 1).getTime() };
    default:
      return { from: Number.NEGATIVE_INFINITY, to: Number.POSITIVE_INFINITY };
  }
}

export function activitiesInRange(
  activities: readonly Activity[],
  range: ExportRange,
  now: Date
): Activity[] {
  const { from, to } = rangeBounds(range, now);
  return activities.filter((a) => {
    const at = new Date(a.createdAt).getTime();
    return at >= from && at < to;
  });
}

const slug = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase();

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface BulkExport {
  entries: ZipEntry[];
  /** Activities that went in as a GPX file. */
  withRoute: number;
  /** Activities listed in the index only, because they have no route to write. */
  withoutRoute: number;
}

/** One GPX per activity that has a route, plus `index.json` listing every activity, including those without one. */
export function buildBulkExport(
  activities: readonly Activity[],
  now: Date,
  range: ExportRange
): BulkExport {
  const entries: ZipEntry[] = [];
  const index: Array<Record<string, unknown>> = [];
  const used = new Set<string>();

  for (const activity of activities) {
    const startedAt = new Date(activity.createdAt);
    const route = parsePolyline(activity.polyline);
    const file = activityExportFile('gpx', activity, route);
    let name: string | null = null;
    if (file) {
      const stem = `${localDate(startedAt)}-${slug(activity.name || activity.activityType) || 'activity'}`;
      let candidate = `${stem}.gpx`;
      for (let n = 2; used.has(candidate); n++) candidate = `${stem}-${n}.gpx`;
      used.add(candidate);
      name = `gpx/${candidate}`;
      entries.push({ name, data: file.content, modified: startedAt });
    }
    index.push({
      id: activity.id,
      name: activity.name ?? null,
      type: activity.activityType,
      startedAt: startedAt.toISOString(),
      distanceMeters: activity.distance,
      durationMs: activity.duration,
      file: name,
    });
  }

  entries.push({
    name: 'index.json',
    data: JSON.stringify(
      { version: 1, exportedAt: now.toISOString(), range, activities: index },
      null,
      2
    ),
  });
  const withRoute = entries.length - 1;
  return { entries, withRoute, withoutRoute: activities.length - withRoute };
}
