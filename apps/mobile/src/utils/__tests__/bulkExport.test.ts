import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { activitiesInRange, buildBulkExport, rangeBounds } from '@/utils/bulkExport';
import { zipStore } from '@/utils/zipStore';
import { unzipStore } from './unzipStore';

const now = new Date(2026, 10, 6, 12);

function activity(id: string, createdAt: Date, polyline = '73.8,18.5;73.8,18.501'): Activity {
  return {
    id,
    userId: '0xabc',
    name: 'Morning run',
    activityType: 'run',
    distance: 111,
    duration: 60_000,
    polyline,
    territory: null,
    territoryArea: 0,
    createdAt,
  };
}

describe('activitiesInRange', () => {
  const list = [
    activity('a', new Date(2026, 10, 1)),
    activity('b', new Date(2026, 3, 1)),
    activity('c', new Date(2025, 5, 1)),
    activity('d', new Date(2024, 5, 1)),
  ];

  it('keeps everything for all time', () => {
    expect(activitiesInRange(list, 'all', now)).toHaveLength(4);
  });

  it('keeps the last 30 days, this year and last year', () => {
    expect(activitiesInRange(list, '30d', now).map((a) => a.id)).toEqual(['a']);
    expect(activitiesInRange(list, 'year', now).map((a) => a.id)).toEqual(['a', 'b']);
    expect(activitiesInRange(list, 'lastYear', now).map((a) => a.id)).toEqual(['c']);
  });

  it('ends last year at the start of this one', () => {
    expect(rangeBounds('lastYear', now).to).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe('buildBulkExport', () => {
  it('writes a GPX per routed activity and an index of all of them', () => {
    const list = [
      activity('a', new Date(2026, 10, 1)),
      activity('b', new Date(2026, 10, 1)),
      activity('c', new Date(2026, 10, 2), ''),
    ];
    const bulk = buildBulkExport(list, now, 'all');
    expect(bulk.withRoute).toBe(2);
    expect(bulk.withoutRoute).toBe(1);

    const files = unzipStore(zipStore(bulk.entries));
    const names = [...files.keys()];
    expect(names).toHaveLength(3);
    expect(names.filter((n) => n.startsWith('gpx/'))).toEqual([
      'gpx/2026-11-01-morning-run.gpx',
      'gpx/2026-11-01-morning-run-2.gpx',
    ]);
    const index = JSON.parse(new TextDecoder().decode(files.get('index.json')));
    expect(index.activities).toHaveLength(3);
    expect(index.activities[2].file).toBeNull();
    expect(new TextDecoder().decode(files.get(index.activities[0].file))).toContain('<trkpt');
  });

  it('still writes an index when nothing is in range', () => {
    const bulk = buildBulkExport([], now, '30d');
    expect(bulk.entries.map((e) => e.name)).toEqual(['index.json']);
  });
});
