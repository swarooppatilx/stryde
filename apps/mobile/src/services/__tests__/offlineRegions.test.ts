import { describe, expect, it } from 'vitest';
import type { OfflineMapStatus } from '@/services/offlineMaps';
import {
  downloadRegion,
  listOfflineStorage,
  type OfflinePacksPort,
  type PackProgress,
  removeRegion,
  type StoredPack,
} from '@/services/offlineRegions';

class FakePacks implements OfflinePacksPort {
  packs = new Map<string, { metadata?: unknown; progress: PackProgress }>();
  steps: PackProgress[] = [];
  failWith: unknown = null;
  created: string[] = [];

  async list(): Promise<StoredPack[]> {
    return [...this.packs].map(([name, { metadata, progress }]) => ({
      name,
      metadata,
      status: async () => progress,
    }));
  }

  async create(
    options: { name: string; metadata: Record<string, string> },
    onProgress: (s: PackProgress) => void,
    onError: (e: unknown) => void
  ) {
    this.created.push(options.name);
    if (this.failWith) {
      onError(this.failWith);
      return;
    }
    for (const step of this.steps) onProgress(step);
    const last = this.steps.at(-1);
    if (last) this.packs.set(options.name, { metadata: options.metadata, progress: last });
  }

  async remove(name: string) {
    this.packs.delete(name);
  }
}

const done = (size: number): PackProgress => ({
  state: 'complete',
  percentage: 100,
  completedResourceSize: size,
});
const region = {
  name: 'Pune',
  styleURL: 'mapbox://styles/x',
  bounds: [
    [74, 19],
    [73, 18],
  ] as [[number, number], [number, number]],
  minZoom: 10,
  maxZoom: 14,
  stamp: 7,
};

describe('downloadRegion', () => {
  it('reports progress up to ready, under an area name', async () => {
    const port = new FakePacks();
    port.steps = [{ state: 'active', percentage: 40, completedResourceSize: 1000 }, done(5000)];
    const heard: OfflineMapStatus[] = [];
    await downloadRegion(port, region, (s) => heard.push(s));
    expect(port.created).toEqual(['area-7']);
    expect(heard.map((s) => [s.state, s.percent])).toEqual([
      ['downloading', 0],
      ['downloading', 40],
      ['ready', 100],
    ]);
  });

  it('reports a failure from the native side', async () => {
    const port = new FakePacks();
    port.failWith = new Error('offline');
    const heard: OfflineMapStatus[] = [];
    await downloadRegion(port, region, (s) => heard.push(s));
    expect(heard.at(-1)?.state).toBe('failed');
  });

  it('reports a failure to start', async () => {
    const port = new FakePacks();
    port.create = async () => {
      throw new Error('boom');
    };
    const heard: OfflineMapStatus[] = [];
    await downloadRegion(port, region, (s) => heard.push(s));
    expect(heard.at(-1)?.state).toBe('failed');
  });
});

describe('listOfflineStorage', () => {
  it('lists areas by name and totals every pack, route maps included', async () => {
    const port = new FakePacks();
    port.packs.set('area-1', { metadata: { name: 'Pune' }, progress: done(4_000_000) });
    port.packs.set('area-2', { progress: done(1_000_000) });
    port.packs.set('route-abc', { progress: done(2_000_000) });
    const storage = await listOfflineStorage(port);
    expect(storage.regions.map((r) => r.name)).toEqual(['Pune', 'Saved area']);
    expect(storage.totalBytes).toBe(7_000_000);
    expect(storage.routeMapCount).toBe(1);
  });
});

describe('removeRegion', () => {
  it('removes an area but never a route map', async () => {
    const port = new FakePacks();
    port.packs.set('area-1', { progress: done(1) });
    port.packs.set('route-abc', { progress: done(1) });
    expect(await removeRegion(port, 'area-1')).toBe(true);
    expect(await removeRegion(port, 'route-abc')).toBe(false);
    expect([...port.packs.keys()]).toEqual(['route-abc']);
  });
});
