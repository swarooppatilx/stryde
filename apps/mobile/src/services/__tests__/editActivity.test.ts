import { describe, expect, it, vi } from 'vitest';
import { straightTrack } from '@/platform/fakes';
import { editActivity } from '@/services/editActivity';
import type { ActivityMetadataInput } from '@/services/postRun';
import type { Activity } from '@/types';
import { parsePolyline, toPolyline } from '@/utils/format';
import { publicRoute } from '@/utils/routePrivacy';

// A 2 km straight route: long enough to trim 200 m from each end.
const route = straightTrack({ speedMps: 4, durationS: 500, intervalS: 5 }).map(
  (fix) => [fix.longitude, fix.latitude] as [number, number]
);

const activity = (overrides: Partial<Activity> = {}): Activity =>
  ({
    id: 'a1',
    userId: '0xme',
    name: 'Morning Run',
    description: 'felt good',
    activityType: 'run',
    distance: 2000,
    duration: 500_000,
    polyline: toPolyline(route),
    territory: null,
    territoryArea: 0,
    createdAt: new Date('2026-10-01T06:00:00Z'),
    onchainActivityId: '7',
    images: ['https://gateway.example/ipfs/photo', 'file:///data/cache/local.jpg'],
    hideRouteEnds: false,
    ...overrides,
  }) as Activity;

type Published = { cid: string; confirmed: boolean } | null;

function setup(setMetadata?: (id: bigint, metadata: ActivityMetadataInput) => Promise<Published>) {
  const updates: Array<{ id: string; patch: Partial<Activity> }> = [];
  const store = {
    updateActivity: (id: string, patch: Partial<Activity>) => updates.push({ id, patch }),
  };
  const published: Array<{ id: bigint; metadata: ActivityMetadataInput }> = [];
  const chain = {
    setMetadata: vi.fn(async (id: bigint, metadata: ActivityMetadataInput): Promise<Published> => {
      published.push({ id, metadata });
      return setMetadata ? setMetadata(id, metadata) : { cid: 'bafyNEW', confirmed: true };
    }),
  };
  return { store, chain, updates, published };
}

describe('editActivity', () => {
  it('changes it on this device at once and republishes the name and description for everyone', async () => {
    const { store, chain, updates, published } = setup();

    const result = await editActivity({ store, chain }, activity(), {
      name: 'Evening Run',
      description: 'rainy',
    });

    expect(result).toEqual({ published: true });
    expect(updates[0]).toEqual({ id: 'a1', patch: { name: 'Evening Run', description: 'rainy' } });
    expect(updates[1]).toEqual({ id: 'a1', patch: { metadataCid: 'bafyNEW' } });
    expect(published[0]?.id).toBe(7n);
    expect(published[0]?.metadata).toMatchObject({ name: 'Evening Run', description: 'rainy' });
  });

  it('republishes only public photo links, never a path on this phone', async () => {
    const { store, chain, published } = setup();

    await editActivity({ store, chain }, activity(), { name: 'x' });

    expect(published[0]?.metadata.photos).toEqual(['https://gateway.example/ipfs/photo']);
  });

  it('republishes the route with its ends hidden if that is how it was first published', async () => {
    const { store, chain, published } = setup();

    await editActivity({ store, chain }, activity({ hideRouteEnds: true }), { name: 'x' });

    const sent = published[0]?.metadata.coordinates ?? [];
    expect(sent.length).toBeLessThan(route.length);
    expect(sent[0]).not.toEqual(route[0]);
    expect(parsePolyline(published[0]?.metadata.polyline ?? '')).toEqual(sent);
  });

  it('republishes exactly the cut the first post made for that activity', async () => {
    const { store, chain, published } = setup();
    const done = activity({ hideRouteEnds: true });

    await editActivity({ store, chain }, done, { name: 'x' });
    await editActivity({ store, chain }, done, { name: 'y' });

    const firstPost = publicRoute(route, { hideEnds: true, zones: [], seed: done.id }).route;
    expect(published[0]?.metadata.coordinates).toEqual(firstPost);
    expect(published[1]?.metadata.coordinates).toEqual(firstPost);
  });

  it('never republishes heart rate, splits, laps, the stream, best efforts or calories', async () => {
    const { store, chain, published } = setup();
    const detailed = activity({
      splits: [{ index: 1, distance: 1000, movingTime: 250_000 }],
      laps: [{ index: 1, distance: 2000, duration: 500_000 }],
      stream: { t: [0, 1], speed: [4, 4], heartRate: { t: [0, 1], bpm: [150, 155] } },
      bestEfforts: [{ distance: 1000, movingTime: 245_000 }],
      heartRate: { avg: 152, max: 171 },
      caloriesBurned: 180,
    });

    await editActivity({ store, chain }, detailed, { name: 'x' });

    const metadata = published[0]?.metadata ?? {};
    const sent = Object.entries(metadata).flatMap(([key, value]) =>
      value === undefined ? [] : [key]
    );
    expect(sent.sort()).toEqual(['coordinates', 'description', 'name', 'photos', 'polyline']);
  });

  it('republishes the whole route if it was published whole', async () => {
    const { store, chain, published } = setup();

    await editActivity({ store, chain }, activity({ hideRouteEnds: false }), { name: 'x' });

    expect(published[0]?.metadata.coordinates?.length).toBe(route.length);
  });

  it('keeps the edit on this device and says so when it cannot be published', async () => {
    const { store, chain, updates } = setup(async () => {
      throw new Error('offline');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await editActivity({ store, chain }, activity(), { name: 'Evening Run' });

    expect(result).toMatchObject({ published: false, reason: 'failed' });
    expect(updates).toEqual([{ id: 'a1', patch: { name: 'Evening Run' } }]);
  });

  it('treats a transaction that was not confirmed as not published', async () => {
    const { store, chain } = setup(async () => ({ cid: 'bafy', confirmed: false }));

    expect(await editActivity({ store, chain }, activity(), { name: 'x' })).toMatchObject({
      published: false,
      reason: 'failed',
    });
  });

  it('only edits locally when the activity is not onchain or there is no wallet', async () => {
    const offline = setup();
    expect(
      await editActivity({ store: offline.store, chain: null }, activity(), { name: 'x' })
    ).toEqual({ published: false, reason: 'local-only' });

    const draft = setup();
    expect(
      await editActivity(
        { store: draft.store, chain: draft.chain },
        activity({ onchainActivityId: undefined }),
        { name: 'x' }
      )
    ).toEqual({ published: false, reason: 'local-only' });
    expect(draft.chain.setMetadata).not.toHaveBeenCalled();
    expect(draft.updates).toHaveLength(1);
  });

  it('ignores an empty title and lets the description be cleared', async () => {
    const { store, chain, updates, published } = setup();

    await editActivity({ store, chain }, activity(), { name: '   ', description: '  ' });

    expect(updates[0]?.patch).toEqual({ description: undefined });
    expect(published[0]?.metadata).toMatchObject({ name: 'Morning Run', description: undefined });
  });

  it('does nothing when nothing changed', async () => {
    const { store, chain, updates } = setup();

    const result = await editActivity({ store, chain }, activity(), {
      name: 'Morning Run',
      description: 'felt good',
    });

    expect(result).toEqual({ published: false, reason: 'unchanged' });
    expect(updates).toEqual([]);
    expect(chain.setMetadata).not.toHaveBeenCalled();
  });

  describe('photos', () => {
    const uploaded = (uri: string) => `https://gateway.example/ipfs/${uri.split('/').pop()}`;

    it('drops a removed photo here and from what others see', async () => {
      const { store, chain, updates, published } = setup();

      await editActivity({ store, chain }, activity(), {
        photos: ['file:///data/cache/local.jpg'],
      });

      expect(updates[0]?.patch.images).toEqual(['file:///data/cache/local.jpg']);
      expect(published[0]?.metadata.photos).toBeUndefined();
    });

    it('uploads a photo added afterwards and publishes its link', async () => {
      const { store, chain, updates, published } = setup();
      const uploader = { upload: vi.fn(async (_name: string, uri: string) => uploaded(uri)) };

      await editActivity({ store, chain, uploader }, activity({ images: [] }), {
        photos: ['file:///data/cache/new.jpg'],
      });

      expect(published[0]?.metadata.photos).toEqual(['https://gateway.example/ipfs/new.jpg']);
      expect(
        updates.some((u) => u.patch.images?.[0] === 'https://gateway.example/ipfs/new.jpg')
      ).toBe(true);
    });

    it('keeps a photo that will not upload on this device and does not publish it', async () => {
      const { store, chain, updates, published } = setup();
      const uploader = {
        upload: vi.fn(async () => {
          throw new Error('offline');
        }),
      };

      const result = await editActivity({ store, chain, uploader }, activity({ images: [] }), {
        photos: ['file:///data/cache/new.jpg'],
      });

      expect(updates[0]?.patch.images).toEqual(['file:///data/cache/new.jpg']);
      expect(published[0]?.metadata.photos).toBeUndefined();
      expect(result).toEqual({ published: true });
    });

    it('treats the same list as no change', async () => {
      const { store, chain } = setup();

      const result = await editActivity({ store, chain }, activity(), {
        photos: [...(activity().images ?? [])],
      });

      expect(result).toEqual({ published: false, reason: 'unchanged' });
    });
  });

  it('republishes the route cut by the zones it was saved with, even if the zones changed since', async () => {
    const home = {
      id: 'h',
      name: 'Home',
      latitude: route[0]?.[1] ?? 0,
      longitude: route[0]?.[0] ?? 0,
      radius: 300,
    };
    const { store, chain, published } = setup();

    await editActivity({ store, chain }, activity({ privacyZones: [home] }), { name: 'Renamed' });

    const coordinates = published[0]?.metadata.coordinates ?? [];
    expect(coordinates.length).toBeGreaterThan(0);
    expect(coordinates.length).toBeLessThan(route.length);
    expect(coordinates[0]).not.toEqual(route[0]);
  });

  it('leaves out the loop shape when a zone cut the route', async () => {
    const home = {
      id: 'h',
      name: 'Home',
      latitude: route[0]?.[1] ?? 0,
      longitude: route[0]?.[0] ?? 0,
      radius: 300,
    };
    const ring = [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ] as never;
    const { store, chain, published } = setup();

    await editActivity({ store, chain }, activity({ privacyZones: [home], territory: ring }), {
      name: 'Renamed',
    });

    expect(published[0]?.metadata.territory).toBeUndefined();
  });
});

describe('editing an Only Me activity', () => {
  const private_ = (overrides: Partial<Activity> = {}) =>
    activity({ privacy: 'only_me', ...overrides });

  it('changes it on this device and publishes nothing', async () => {
    const { store, chain, updates, published } = setup();

    const result = await editActivity({ store, chain }, private_(), { name: 'Secret run' });

    expect(result).toEqual({ published: false, reason: 'local-only' });
    expect(updates[0]?.patch.name).toBe('Secret run');
    expect(published).toHaveLength(0);
  });

  it('uploads no photo it is given', async () => {
    const { store, chain, updates } = setup();
    const uploader = { upload: vi.fn(async (_name: string, uri: string) => uri) };

    await editActivity({ store, chain, uploader }, private_({ images: [] }), {
      photos: ['file:///data/cache/new.jpg'],
    });

    expect(uploader.upload).not.toHaveBeenCalled();
    expect(updates[0]?.patch.images).toEqual(['file:///data/cache/new.jpg']);
  });
});

describe('editing an activity whose route is hidden', () => {
  it('republishes the text without the route or its outline', async () => {
    const { store, chain, published } = setup();
    const ring = [
      [73.85, 18.52],
      [73.851, 18.52],
      [73.851, 18.521],
      [73.85, 18.52],
    ] as Activity['territory'];

    await editActivity({ store, chain }, activity({ hideRoute: true, territory: ring }), {
      name: 'Evening Run',
    });

    expect(published[0]?.metadata.name).toBe('Evening Run');
    expect(published[0]?.metadata.polyline).toBeUndefined();
    expect(published[0]?.metadata.coordinates).toBeUndefined();
    expect(published[0]?.metadata.territory).toBeUndefined();
  });
});
