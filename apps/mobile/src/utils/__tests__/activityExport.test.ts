import { describe, expect, it } from 'vitest';
import { activityExportFile } from '@/utils/activityExport';
import { trackFromFit } from '@/utils/importFit';
import { tracksFromTcx } from '@/utils/importTcx';

const route: [number, number][] = [
  [73.8, 18.5],
  [73.8, 18.501],
  [73.8, 18.502],
];
const activity = {
  name: 'Run',
  activityType: 'run' as const,
  distance: 222,
  duration: 60_000,
  createdAt: new Date('2026-10-16T06:01:00Z'),
};

describe('activityExportFile', () => {
  it('writes GPX, TCX and FIT that their readers accept', () => {
    const gpx = activityExportFile('gpx', activity, route);
    expect(gpx?.content).toContain('<trkpt');

    const tcx = activityExportFile('tcx', activity, route);
    expect(tcx && tracksFromTcx(tcx.content)?.[0]?.points).toHaveLength(3);

    const fit = activityExportFile('fit', activity, route);
    expect(fit?.encoding).toBe('base64');
    const bytes = fit ? Uint8Array.from(Buffer.from(fit.content, 'base64')) : new Uint8Array();
    const read = trackFromFit(bytes);
    expect(read.ok && read.track.points).toHaveLength(3);
  });

  it('writes nothing without a route', () => {
    expect(activityExportFile('tcx', activity, [])).toBeNull();
    expect(activityExportFile('gpx', activity, [])).toBeNull();
  });
});
