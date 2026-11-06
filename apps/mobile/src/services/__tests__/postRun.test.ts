import { services } from '@repo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_EPOCH_MS, FakeClock, SequentialIds } from '@/platform/fakes';
import { FakeActivityChain, FakePhotoUploader, MemoryPostRunStore } from '@/services/fakes/postRun';
import {
  EmptyRecordingError,
  isSyncing,
  type PostRunDeps,
  type PostRunInput,
  retryOnChain,
  savePostRun,
} from '@/services/postRun';
import type { Ring } from '@/types';
import { getActivityName } from '@/utils/format';

const RING: Ring = [
  [73.85, 18.52],
  [73.851, 18.52],
  [73.851, 18.521],
  [73.85, 18.52],
];

const INPUT: PostRunInput = {
  title: 'Evening Run',
  description: '  felt good  ',
  activityType: 'run',
  distance: 5000,
  duration: 1_800_000,
  polyline: '73.85,18.52;73.851,18.521;73.852,18.522',
  territory: null,
  territoryArea: 0,
  photos: [],
  privacy: 'everyone',
  isManual: false,
};

let chain: FakeActivityChain;
let store: MemoryPostRunStore;
let uploader: FakePhotoUploader;
let verified: boolean;

function deps(overrides: Partial<PostRunDeps> = {}): PostRunDeps {
  return {
    clock: new FakeClock(),
    ids: new SequentialIds(),
    userId: '0xuser',
    store,
    uploader,
    chain,
    isVerified: () => verified,
    ...overrides,
  };
}

beforeEach(() => {
  chain = new FakeActivityChain();
  store = new MemoryPostRunStore();
  uploader = new FakePhotoUploader();
  verified = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('refusing a recording with no route', () => {
  it('will not publish a GPS sport whose recording has under two route points', async () => {
    for (const polyline of ['', '73.85,18.52']) {
      await expect(savePostRun({ ...INPUT, polyline }, deps())).rejects.toBeInstanceOf(
        EmptyRecordingError
      );
    }
    expect(() => store.get('id-1')).toThrow();
    expect(chain.callsTo('setMetadata')).toHaveLength(0);
  });

  it('still saves a manual entry, which has no route by nature', async () => {
    const result = await savePostRun({ ...INPUT, polyline: '', isManual: true }, deps());

    expect(result.activity.isManual).toBe(true);
    expect(store.get('id-1')).toBeDefined();
  });

  it('still saves a sport that is not tracked by GPS', async () => {
    await savePostRun({ ...INPUT, activityType: 'workout', polyline: '' }, deps());

    expect(store.get('id-1')).toBeDefined();
  });
});

describe('what the athlete adds about the effort', () => {
  it('keeps the effort, the commute flag and a trimmed private note', async () => {
    await savePostRun(
      { ...INPUT, effort: 'hard', isCommute: true, privateNote: '  left knee tight  ' },
      deps()
    );

    expect(store.get('id-1')).toMatchObject({
      effort: 'hard',
      isCommute: true,
      privateNote: 'left knee tight',
    });
  });

  it('leaves them out when the athlete said nothing', async () => {
    await savePostRun({ ...INPUT, privateNote: '   ' }, deps());

    const saved = store.get('id-1');
    expect(saved.effort).toBeUndefined();
    expect(saved.isCommute).toBeUndefined();
    expect(saved.privateNote).toBeUndefined();
  });
});

describe('the climb of a recorded activity', () => {
  it('is saved with the activity, so it is there without any network', async () => {
    await savePostRun({ ...INPUT, elevationGain: 42, elevationLoss: 40 }, deps());

    expect(store.get('id-1')).toMatchObject({ elevationGain: 42, elevationLoss: 40 });
  });

  it('is left unset when the recording had no altitude', async () => {
    await savePostRun(INPUT, deps());

    expect(store.get('id-1').elevationGain).toBeUndefined();
  });
});

describe('saving on this device', () => {
  it('always saves the activity locally first, exactly as the user entered it', async () => {
    const result = await savePostRun(INPUT, deps());

    const saved = store.get('id-1');
    expect(result.activity.id).toBe('id-1');
    expect(saved).toMatchObject({
      userId: '0xuser',
      name: 'Evening Run',
      description: 'felt good',
      distance: 5000,
      duration: 1_800_000,
      privacy: 'everyone',
      isManual: false,
    });
    expect(saved.createdAt.getTime()).toBe(FAKE_EPOCH_MS);
    expect(store.log[0]).toBe('save');
  });

  it('names an untitled activity after the time of day', async () => {
    await savePostRun({ ...INPUT, title: '   ' }, deps());

    const expected = getActivityName('run', new Date(FAKE_EPOCH_MS).getHours());
    expect(store.get('id-1').name).toBe(expected);
  });

  it('hashes route, area and id together so identical manual entries never collide', async () => {
    const ids = new SequentialIds();
    const first = await savePostRun(INPUT, deps({ ids }));
    const second = await savePostRun(INPUT, deps({ ids }));

    expect(first.activity.activityHash).toBe(
      services.activity.computeActivityHash(INPUT.polyline, 0, 'id-1')
    );
    expect(first.activity.activityHash).not.toBe(second.activity.activityHash);
  });

  it('keeps a manual activity on this device when there is no wallet', async () => {
    const result = await savePostRun(
      { ...INPUT, polyline: '', isManual: true },
      deps({ chain: null })
    );

    expect(store.activities.size).toBe(1);
    expect(result.onchainFailed).toBe(false);
    expect(result.needsVerification).toBe(false);
    expect(Object.values(result.steps).every((s) => s.status === 'skipped')).toBe(true);
    expect(chain.calls).toHaveLength(0);
  });

  it('remembers whether the published route had its ends hidden, so a later edit republishes it the same way', async () => {
    const hidden = await savePostRun({ ...INPUT, hideRouteEnds: true }, deps({ chain: null }));
    const shown = await savePostRun({ ...INPUT, hideRouteEnds: false }, deps({ chain: null }));
    const unset = await savePostRun({ ...INPUT }, deps({ chain: null }));

    expect(hidden.activity.hideRouteEnds).toBe(true);
    expect(shown.activity.hideRouteEnds).toBe(false);
    expect(unset.activity.hideRouteEnds).toBe(false);
  });

  it('keeps the laps on the saved activity', async () => {
    const laps = [
      { index: 1, distance: 1000, duration: 300_000 },
      { index: 2, distance: 800, duration: 250_000 },
    ];

    const { activity } = await savePostRun({ ...INPUT, laps }, deps({ chain: null }));

    expect(activity.laps).toEqual(laps);
    expect(store.activities.get(activity.id)?.laps).toEqual(laps);
  });

  it('keeps the best efforts on the saved activity', async () => {
    const bestEfforts = [{ distance: 1000, movingTime: 250_000 }];

    const { activity } = await savePostRun({ ...INPUT, bestEfforts }, deps({ chain: null }));

    expect(activity.bestEfforts).toEqual(bestEfforts);
    expect(store.activities.get(activity.id)?.bestEfforts).toEqual(bestEfforts);
  });

  it('keeps the recorded splits on the saved activity', async () => {
    const splits = [{ index: 1, distance: 1000, movingTime: 300_000 }];

    const { activity } = await savePostRun({ ...INPUT, splits }, deps({ chain: null }));

    expect(activity.splits).toEqual(splits);
    expect(store.activities.get(activity.id)?.splits).toEqual(splits);
  });

  it('records the captured territory locally even if nothing goes onchain', async () => {
    await savePostRun({ ...INPUT, territory: RING, territoryArea: 1200 }, deps({ chain: null }));

    expect(store.polygons).toEqual([{ userId: '0xuser', territory: RING }]);
  });
});

describe('saving before the slow parts', () => {
  /** An uploader that waits until `release()`, so a test can look at the world mid-upload. */
  function heldUploader() {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = {
      uploads: [] as string[],
      async upload(_name: string, uri: string) {
        held.uploads.push(uri);
        await gate;
        return `https://ipfs.test/${encodeURIComponent(uri)}`;
      },
    };
    return { held, release };
  }

  it('has the activity safely on the device before the first photo upload starts', async () => {
    const { held, release } = heldUploader();

    const saving = savePostRun({ ...INPUT, photos: ['file:///a.jpg'] }, deps({ uploader: held }));
    await vi.waitFor(() => expect(held.uploads).toHaveLength(1));

    expect(store.get('id-1')).toMatchObject({ images: ['file:///a.jpg'], name: 'Evening Run' });
    release();
    await saving;
  });

  it('swaps in the published photo links once they are uploaded', async () => {
    const { held, release } = heldUploader();

    const saving = savePostRun({ ...INPUT, photos: ['file:///a.jpg'] }, deps({ uploader: held }));
    await vi.waitFor(() => expect(held.uploads).toHaveLength(1));
    release();
    const result = await saving;

    expect(store.get('id-1').images).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fa.jpg']);
    expect(result.activity.images).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fa.jpg']);
  });

  it('keeps a background retry away while the photos are still going up, so nothing is recorded twice', async () => {
    const { held, release } = heldUploader();

    const saving = savePostRun({ ...INPUT, photos: ['file:///a.jpg'] }, deps({ uploader: held }));
    await vi.waitFor(() => expect(held.uploads).toHaveLength(1));

    expect(isSyncing('id-1')).toBe(true);
    release();
    await saving;
    expect(isSyncing('id-1')).toBe(false);
  });

  it('is still saved, and retryable, when the app dies mid-upload', async () => {
    const dying = {
      async upload(): Promise<string> {
        throw new Error('killed');
      },
    };

    chain.failures.recordActivity = new Error('rpc down');
    await savePostRun({ ...INPUT, photos: ['file:///a.jpg'] }, deps({ uploader: dying }));
    const saved = store.get('id-1');
    delete chain.failures.recordActivity;
    chain.calls = [];

    // The next launch's retry uploads the photo and records the run.
    const retry = await retryOnChain(saved, deps());
    expect(retry.onchainFailed).toBe(false);
    expect(store.get('id-1').images).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fa.jpg']);
  });
});

describe('when it happened', () => {
  it('dates a recorded activity at the moment it was saved', async () => {
    await savePostRun(INPUT, deps());

    expect(store.get('id-1').createdAt.getTime()).toBe(FAKE_EPOCH_MS);
  });

  it('dates an imported workout when it started, not when it was imported', async () => {
    const startedAt = FAKE_EPOCH_MS - 3 * 86_400_000;

    await savePostRun({ ...INPUT, startedAt }, deps());

    expect(store.get('id-1').createdAt.getTime()).toBe(startedAt);
  });
});

describe('photos', () => {
  it('uploads local photos, passes web links through, and keeps their order', async () => {
    const photos = ['file:///a.jpg', 'https://cdn.test/b.jpg', 'file:///c.jpg'];

    await savePostRun({ ...INPUT, photos }, deps());

    expect(uploader.uploads.map((u) => u.uri)).toEqual(['file:///a.jpg', 'file:///c.jpg']);
    expect(store.get('id-1').images).toEqual([
      'https://ipfs.test/file%3A%2F%2F%2Fa.jpg',
      'https://cdn.test/b.jpg',
      'https://ipfs.test/file%3A%2F%2F%2Fc.jpg',
    ]);
  });

  it('keeps a photo on the device when its upload fails, instead of losing the activity', async () => {
    uploader.failFor.add('file:///bad.jpg');

    await savePostRun({ ...INPUT, photos: ['file:///bad.jpg', 'file:///ok.jpg'] }, deps());

    const images = store.get('id-1').images ?? [];
    expect(images[0]).toBe('file:///bad.jpg');
    expect(images[1]).toMatch(/^https:\/\/ipfs\.test\//);
  });

  it('retries the metadata upload once when the first try fails on the network', async () => {
    chain.failOnce.add('setMetadata');

    const { steps, activity } = await savePostRun(INPUT, deps({ retryDelayMs: 0 }));

    expect(chain.callsTo('setMetadata')).toHaveLength(2);
    expect(steps.metadata.status).toBe('ok');
    expect(store.activities.get(activity.id)?.metadataCid).toBeTruthy();
  });

  it('still reports the metadata step as failed when the retry fails too', async () => {
    chain.failures.setMetadata = new Error('pinning down');

    const { steps } = await savePostRun(INPUT, deps({ retryDelayMs: 0 }));

    expect(chain.callsTo('setMetadata')).toHaveLength(2);
    expect(steps.metadata.status).toBe('failed');
  });

  it('never publishes a photo that only exists on this device', async () => {
    uploader.failFor.add('file:///bad.jpg');

    await savePostRun({ ...INPUT, photos: ['file:///bad.jpg', 'file:///ok.jpg'] }, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { photos?: string[] }];
    expect(metadata.photos).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fok.jpg']);
  });

  it('keeps the feed mute and hidden stats on the activity and publishes them with it', async () => {
    const result = await savePostRun(
      { ...INPUT, mutedFromFeeds: true, hiddenStats: ['pace', 'start_time'] },
      deps()
    );

    expect(result.activity).toMatchObject({
      mutedFromFeeds: true,
      hiddenStats: ['pace', 'start_time'],
    });
    const [, metadata] = chain.callsTo('setMetadata')[0] as [
      bigint,
      { mutedFromFeeds?: boolean; hiddenStats?: string[] },
    ];
    expect(metadata.mutedFromFeeds).toBe(true);
    expect(metadata.hiddenStats).toEqual(['pace', 'start_time']);
  });

  it('leaves both out when they are off or empty', async () => {
    const result = await savePostRun({ ...INPUT, mutedFromFeeds: false, hiddenStats: [] }, deps());

    expect(result.activity.mutedFromFeeds).toBeUndefined();
    expect(result.activity.hiddenStats).toBeUndefined();
    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, Record<string, unknown>];
    expect(metadata).not.toHaveProperty('mutedFromFeeds');
    expect(metadata).not.toHaveProperty('hiddenStats');
  });

  it('uploads a still-local photo when the onchain sync is retried', async () => {
    uploader.failFor.add('file:///bad.jpg');
    chain.failures.recordActivity = new Error('rpc down');
    const { activity } = await savePostRun({ ...INPUT, photos: ['file:///bad.jpg'] }, deps());
    delete chain.failures.recordActivity;
    uploader.failFor.clear();
    chain.calls = [];

    await retryOnChain(store.get(activity.id), deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { photos?: string[] }];
    expect(metadata.photos).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fbad.jpg']);
    expect(store.get(activity.id).images).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fbad.jpg']);
  });

  it('retries without the photo link when it still will not upload', async () => {
    uploader.failFor.add('file:///bad.jpg');
    chain.failures.recordActivity = new Error('rpc down');
    const { activity } = await savePostRun({ ...INPUT, photos: ['file:///bad.jpg'] }, deps());
    delete chain.failures.recordActivity;
    chain.calls = [];

    const result = await retryOnChain(store.get(activity.id), deps());

    expect(result.onchainFailed).toBe(false);
    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { photos?: string[] }];
    expect(metadata.photos).toBeUndefined();
    expect(store.get(activity.id).images).toEqual(['file:///bad.jpg']);
  });

  it('uploads at most three photos at a time', async () => {
    const photos = Array.from({ length: 8 }, (_, i) => `file:///p${i}.jpg`);

    await savePostRun({ ...INPUT, photos }, deps());

    expect(uploader.peakInFlight).toBe(3);
  });

  it('sends the uploaded photo links, not the local files, to the onchain metadata', async () => {
    await savePostRun({ ...INPUT, photos: ['file:///a.jpg'] }, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { photos?: string[] }];
    expect(metadata.photos).toEqual(['https://ipfs.test/file%3A%2F%2F%2Fa.jpg']);
  });
});

describe('an Only Me activity', () => {
  const PRIVATE: PostRunInput = {
    ...INPUT,
    privacy: 'only_me',
    photos: ['file:///private.jpg'],
    territory: RING,
    territoryArea: 1200,
  };

  it('publishes none of its details: no metadata, no photo upload, no public territory', async () => {
    const result = await savePostRun(PRIVATE, deps());

    expect(chain.methods).not.toContain('setMetadata');
    expect(chain.methods).not.toContain('claimTerritory');
    expect(chain.methods).not.toContain('mintTerritoryNft');
    expect(uploader.uploads).toEqual([]);
    expect(result.steps.metadata).toEqual({ status: 'skipped', reason: 'private activity' });
    expect(result.steps.territory).toEqual({ status: 'skipped', reason: 'private activity' });
  });

  it('still anchors the summary, so it counts for distance and rewards', async () => {
    const result = await savePostRun(PRIVATE, deps());

    expect(chain.methods).toContain('recordActivity');
    expect(chain.methods).toContain('mintReward');
    expect(result.onchainFailed).toBe(false);
  });

  it('keeps its photos on this device and its territory in the local record', async () => {
    await savePostRun(PRIVATE, deps());

    expect(store.get('id-1')?.images).toEqual(['file:///private.jpg']);
    expect(store.polygons).toEqual([{ userId: '0xuser', territory: RING }]);
  });

  it('does not publish on a later retry either', async () => {
    const chainDown = new FakeActivityChain();
    chainDown.failures.recordActivity = new Error('down');
    const first = await savePostRun(PRIVATE, deps({ chain: chainDown }));
    expect(first.onchainFailed).toBe(true);

    await retryOnChain(store.get('id-1') as never, deps());

    expect(chain.methods).not.toContain('setMetadata');
    expect(uploader.uploads).toEqual([]);
  });

  it('is unaffected for an activity shared with everyone', async () => {
    await savePostRun({ ...PRIVATE, privacy: 'everyone' }, deps());

    expect(chain.methods).toContain('setMetadata');
    expect(chain.methods).toContain('claimTerritory');
    expect(uploader.uploads).toHaveLength(1);
  });
});

describe('an activity with its route hidden', () => {
  const HIDDEN: PostRunInput = {
    ...INPUT,
    hideRoute: true,
    territory: RING,
    territoryArea: 1200,
    photos: ['file:///a.jpg'],
  };

  it('publishes its name, description and photos but not its route or territory', async () => {
    await savePostRun(HIDDEN, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [
      bigint,
      {
        name?: string;
        description?: string;
        photos?: string[];
        polyline?: string;
        coordinates?: unknown;
        territory?: unknown;
      },
    ];
    expect(metadata.name).toBe('Evening Run');
    expect(metadata.description).toBe('felt good');
    expect(metadata.photos).toHaveLength(1);
    expect(metadata.polyline).toBeUndefined();
    expect(metadata.coordinates).toBeUndefined();
    expect(metadata.territory).toBeUndefined();
  });

  it('makes no territory claim, since its outline would give the route away', async () => {
    const result = await savePostRun(HIDDEN, deps());

    expect(chain.methods).not.toContain('claimTerritory');
    expect(result.steps.territory).toEqual({ status: 'skipped', reason: 'route hidden' });
  });

  it('keeps the whole route on this device', async () => {
    await savePostRun(HIDDEN, deps());

    expect(store.get('id-1')?.polyline).toBe(INPUT.polyline);
    expect(store.polygons).toEqual([{ userId: '0xuser', territory: RING }]);
  });

  it('hides the route on a later retry too', async () => {
    const chainDown = new FakeActivityChain();
    chainDown.failures.recordActivity = new Error('down');
    await savePostRun(HIDDEN, deps({ chain: chainDown }));

    await retryOnChain(store.get('id-1') as never, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { polyline?: string }];
    expect(metadata.polyline).toBeUndefined();
  });

  it('is unaffected when the route is not hidden', async () => {
    await savePostRun({ ...HIDDEN, hideRoute: false }, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { polyline?: string }];
    expect(metadata.polyline).toBe(INPUT.polyline);
  });
});

describe('the detail a recording carries beyond its route', () => {
  // Only these reach the public metadata; distance and time are already public onchain.
  const PUBLISHED_KEYS = ['coordinates', 'description', 'name', 'photos', 'polyline', 'territory'];
  const DETAILED: PostRunInput = {
    ...INPUT,
    splits: [{ index: 1, distance: 1000, movingTime: 360_000 }],
    laps: [{ index: 1, distance: 2500, duration: 900_000 }],
    stream: { t: [0, 1], speed: [3, 3], heartRate: { t: [0, 1], bpm: [140, 150] } },
    bestEfforts: [{ distance: 1000, movingTime: 350_000 }],
    heartRate: { avg: 145, max: 170 },
    caloriesBurned: 410,
    elevationGain: 40,
    elevationLoss: 38,
  };

  it('never publishes heart rate, splits, laps, the stream, best efforts or calories', async () => {
    await savePostRun(DETAILED, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, Record<string, unknown>];
    const sent = Object.keys(metadata).filter((key) => metadata[key] !== undefined);
    expect(sent.every((key) => PUBLISHED_KEYS.includes(key))).toBe(true);
  });

  it('keeps all of it on this device', async () => {
    await savePostRun(DETAILED, deps());

    expect(store.get('id-1')).toMatchObject({
      heartRate: { avg: 145, max: 170 },
      caloriesBurned: 410,
      splits: DETAILED.splits,
      laps: DETAILED.laps,
      stream: DETAILED.stream,
    });
  });
});

describe('an activity recorded with a simulated location', () => {
  const FAKE: PostRunInput = { ...INPUT, mocked: true, territory: RING, territoryArea: 1200 };

  it('is still anchored, but earns no reward, season credit or territory', async () => {
    const result = await savePostRun(FAKE, deps());

    expect(chain.methods).toContain('recordActivity');
    expect(chain.methods).not.toContain('mintReward');
    expect(chain.methods).not.toContain('recordSeasonContribution');
    expect(chain.methods).not.toContain('claimTerritory');
    expect(result.steps.reward).toEqual({ status: 'skipped', reason: 'simulated location' });
    expect(result.steps.territory).toEqual({ status: 'skipped', reason: 'simulated location' });
  });

  it('is remembered on the activity, so a retry stays the same and records can leave it out', async () => {
    await savePostRun(FAKE, deps());

    expect(store.get('id-1')?.mocked).toBe(true);
  });

  it('is not held against an ordinary activity', async () => {
    await savePostRun(INPUT, deps());

    expect(chain.methods).toContain('mintReward');
    expect(store.get('id-1')?.mocked).toBeUndefined();
  });
});

describe('recording onchain', () => {
  it('runs record, metadata, season and reward in order and stores what each returned', async () => {
    const result = await savePostRun(INPUT, deps());

    expect(chain.methods).toEqual([
      'recordActivity',
      'setMetadata',
      'recordSeasonContribution',
      'mintReward',
    ]);
    expect(store.get('id-1')).toMatchObject({
      txHash: `0x${'aa'.repeat(32)}`,
      onchainActivityId: '7',
      metadataCid: 'bafy-meta',
      strdEarned: 5,
    });
    expect(result.onchainFailed).toBe(false);
    expect(result.steps.record).toEqual({ status: 'ok' });
  });

  it('sends the route as coordinates so other devices can draw it', async () => {
    await savePostRun(INPUT, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [
      bigint,
      { coordinates?: Array<[number, number]>; polyline?: string },
    ];
    expect(metadata.coordinates).toEqual([
      [73.85, 18.52],
      [73.851, 18.521],
      [73.852, 18.522],
    ]);
    expect(metadata.polyline).toBe(INPUT.polyline);
  });

  it('tells the user when the activity itself never made it onchain', async () => {
    chain.failures.recordActivity = new Error('rpc down');

    const result = await savePostRun(INPUT, deps());

    expect(result.onchainFailed).toBe(true);
    expect(result.steps.record).toMatchObject({ status: 'failed' });
    expect(chain.methods).toEqual(['recordActivity']);
    expect(store.get('id-1').txHash).toBeUndefined();
  });

  it('keeps the tx hash but stops there when the transaction is not confirmed', async () => {
    chain.recordResult = { ...chain.recordResult, confirmed: false };

    const result = await savePostRun(INPUT, deps());

    expect(result.onchainFailed).toBe(true);
    expect(store.get('id-1').txHash).toBeDefined();
    expect(store.get('id-1').onchainActivityId).toBeUndefined();
    expect(chain.methods).toEqual(['recordActivity']);
  });

  it('publishes the route without its ends when the athlete hides them, but keeps it whole locally', async () => {
    const route = Array.from(
      { length: 101 },
      (_, i) => `73.85,${(18.52 + i * 0.0001).toFixed(4)}`
    ).join(';');

    await savePostRun({ ...INPUT, polyline: route, hideRouteEnds: true }, deps());

    const [, metadata] = chain.callsTo('setMetadata')[0] as [
      bigint,
      { coordinates?: unknown[]; polyline?: string },
    ];
    expect(metadata.coordinates?.length).toBeLessThan(70);
    expect(metadata.polyline?.split(';').length).toBe(metadata.coordinates?.length);
    expect(store.get('id-1').polyline).toBe(route);
  });

  it('does not publish the loop shape when the route ends are hidden', async () => {
    await savePostRun(
      { ...INPUT, hideRouteEnds: true, territory: RING, territoryArea: 900 },
      deps()
    );

    const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { territory?: unknown }];
    expect(metadata.territory).toBeUndefined();
  });

  describe('privacy zones', () => {
    const route = Array.from(
      { length: 101 },
      (_, i) => `73.85,${(18.52 + i * 0.0001).toFixed(4)}`
    ).join(';');
    const home = { id: 'home', name: 'Home', latitude: 18.52, longitude: 73.85, radius: 200 };

    it('publishes the route without the part inside a zone, keeps it whole locally, and remembers the zones', async () => {
      await savePostRun({ ...INPUT, polyline: route, privacyZones: [home] }, deps());

      const [, metadata] = chain.callsTo('setMetadata')[0] as [
        bigint,
        { coordinates?: unknown[]; polyline?: string },
      ];
      expect(metadata.coordinates?.length).toBeGreaterThan(75);
      expect(metadata.coordinates?.length).toBeLessThan(90);
      expect(store.get('id-1').polyline).toBe(route);
      expect(store.get('id-1').privacyZones).toEqual([home]);
    });

    it('does not publish the loop shape when a zone cut the route, since it would point at the zone', async () => {
      await savePostRun(
        { ...INPUT, polyline: route, privacyZones: [home], territory: RING, territoryArea: 900 },
        deps()
      );

      const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { territory?: unknown }];
      expect(metadata.territory).toBeUndefined();
    });

    it('still publishes the loop when no zone touched the route', async () => {
      const far = { ...home, latitude: 10, longitude: 10 };

      await savePostRun(
        { ...INPUT, polyline: route, privacyZones: [far], territory: RING, territoryArea: 900 },
        deps()
      );

      const [, metadata] = chain.callsTo('setMetadata')[0] as [bigint, { territory?: unknown }];
      expect(metadata.territory).toEqual(RING);
    });
  });

  it('credits the season with the same activity hash the reward uses', async () => {
    const { activity } = await savePostRun(INPUT, deps());

    expect(chain.callsTo('recordSeasonContribution')).toEqual([
      [activity.activityHash, INPUT.distance],
    ]);
    expect(chain.callsTo('mintReward')).toEqual([[activity.activityHash, INPUT.distance]]);
  });

  it('does not fail the save when the metadata upload fails; season and reward still run', async () => {
    chain.failures.setMetadata = new Error('ipfs down');

    const result = await savePostRun(INPUT, deps());

    expect(result.onchainFailed).toBe(false);
    expect(result.steps.metadata).toMatchObject({ status: 'failed' });
    expect(chain.methods).toContain('recordSeasonContribution');
    expect(chain.methods).toContain('mintReward');
    expect(store.get('id-1').metadataCid).toBeUndefined();
  });

  it('still mints the reward when the season contribution fails', async () => {
    chain.failures.recordSeasonContribution = new Error('not a recorder');

    const result = await savePostRun(INPUT, deps());

    expect(result.steps.season).toMatchObject({ status: 'failed' });
    expect(result.steps.reward).toEqual({ status: 'ok' });
    expect(store.get('id-1').strdEarned).toBe(5);
  });

  it('does not show a failure when the relayer says the season contribution already counts', async () => {
    chain.failures.recordSeasonContribution = Object.assign(new Error('already counts'), {
      status: 409,
    });

    const result = await savePostRun(INPUT, deps());

    expect(result.steps.season).toEqual({
      status: 'skipped',
      reason: 'already counted or being counted',
    });
    expect(result.steps.reward).toEqual({ status: 'ok' });
  });

  it('does not claim an earning it cannot see: relayed rewards report no amount', async () => {
    chain.rewardResult = { amount: 0n, confirmed: true };

    await savePostRun(INPUT, deps());

    expect(store.get('id-1').strdEarned).toBeUndefined();
  });

  it('skips metadata quietly when there is nothing to store', async () => {
    chain.metadataResult = null;

    const result = await savePostRun(INPUT, deps());

    expect(result.steps.metadata).toEqual({ status: 'skipped', reason: 'nothing to store' });
    expect(result.onchainFailed).toBe(false);
  });
});

describe('claiming territory', () => {
  const territoryInput: PostRunInput = { ...INPUT, territory: RING, territoryArea: 1200 };

  it('claims the territory and mints its NFT once verified', async () => {
    const result = await savePostRun(territoryInput, deps());

    expect(chain.callsTo('claimTerritory')).toEqual([[RING, 1200]]);
    expect(chain.callsTo('mintTerritoryNft')).toEqual([[`0x${'bb'.repeat(32)}`]]);
    expect(result.needsVerification).toBe(false);
  });

  it('makes no claim when the route ends are hidden, since the outline would show them', async () => {
    const result = await savePostRun({ ...territoryInput, hideRouteEnds: true }, deps());

    expect(chain.methods).not.toContain('claimTerritory');
    expect(result.steps.territory).toEqual({ status: 'skipped', reason: 'route ends hidden' });
  });

  it('makes no claim when a privacy zone cut the route', async () => {
    const route = Array.from(
      { length: 101 },
      (_, i) => `73.85,${(18.52 + i * 0.0001).toFixed(4)}`
    ).join(';');
    const home = { id: 'home', name: 'Home', latitude: 18.52, longitude: 73.85, radius: 200 };

    const result = await savePostRun(
      { ...territoryInput, polyline: route, privacyZones: [home] },
      deps()
    );

    expect(chain.methods).not.toContain('claimTerritory');
    expect(result.steps.territory).toEqual({ status: 'skipped', reason: 'privacy zone' });
    expect(result.onchainFailed).toBe(false);
  });

  it('asks an unverified user to verify instead of claiming', async () => {
    verified = false;

    const result = await savePostRun(territoryInput, deps());

    expect(result.needsVerification).toBe(true);
    expect(chain.methods).not.toContain('claimTerritory');
    // the activity and its distance are still recorded
    expect(chain.methods).toContain('recordActivity');
    expect(chain.methods).toContain('mintReward');
    expect(result.onchainFailed).toBe(false);
  });

  it('does not ask for verification when there is nothing to claim', async () => {
    verified = false;

    const result = await savePostRun(INPUT, deps());

    expect(result.needsVerification).toBe(false);
  });

  it('claims even if recording the activity failed: they are independent', async () => {
    chain.failures.recordActivity = new Error('boom');

    const result = await savePostRun(territoryInput, deps());

    expect(chain.methods).toContain('claimTerritory');
    expect(result.onchainFailed).toBe(true);
  });

  it('reports a failed or unconfirmed claim and skips the NFT', async () => {
    chain.failures.claimTerritory = new Error('reverted');
    const thrown = await savePostRun(territoryInput, deps());

    expect(thrown.onchainFailed).toBe(true);
    expect(chain.methods).not.toContain('mintTerritoryNft');

    chain = new FakeActivityChain();
    chain.claimResult = { ...chain.claimResult, confirmed: false };
    const unconfirmed = await savePostRun(territoryInput, deps());

    expect(unconfirmed.onchainFailed).toBe(true);
    expect(chain.methods).not.toContain('mintTerritoryNft');
  });

  it('does not alarm the user when only the NFT mint fails', async () => {
    chain.failures.mintTerritoryNft = new Error('relayer out of gas');

    const result = await savePostRun(territoryInput, deps());

    expect(result.onchainFailed).toBe(false);
    expect(result.steps.territory).toEqual({ status: 'ok' });
    expect(result.steps.territoryNft).toMatchObject({ status: 'failed' });
  });
});

describe('retrying a failed onchain sync', () => {
  async function savedButNotOnchain() {
    chain.failures.recordActivity = new Error('rpc down');
    const { activity } = await savePostRun(INPUT, deps());
    delete chain.failures.recordActivity;
    chain.calls = [];
    return store.get(activity.id);
  }

  it('records the saved activity onchain this time and stores the proof', async () => {
    const saved = await savedButNotOnchain();
    expect(saved.onchainActivityId).toBeUndefined();

    const result = await retryOnChain(saved, deps());

    expect(result.onchainFailed).toBe(false);
    expect(store.get(saved.id)).toMatchObject({
      txHash: `0x${'aa'.repeat(32)}`,
      onchainActivityId: '7',
      metadataCid: 'bafy-meta',
    });
    expect(chain.methods).toEqual([
      'recordActivity',
      'setMetadata',
      'recordSeasonContribution',
      'mintReward',
    ]);
  });

  it('records it with the same id, route and stats that were saved', async () => {
    const saved = await savedButNotOnchain();

    await retryOnChain(saved, deps());

    const [params] = chain.callsTo('recordActivity')[0] as [
      { polyline: string; distance: number; duration: number; metadata: string },
    ];
    expect(params).toMatchObject({
      polyline: INPUT.polyline,
      distance: INPUT.distance,
      duration: INPUT.duration,
      metadata: saved.id,
    });
  });

  it('does nothing for an activity that is already onchain, so it can never be recorded twice', async () => {
    await savePostRun(INPUT, deps());
    const onchain = store.get('id-1');
    chain.calls = [];

    const result = await retryOnChain(onchain, deps());

    expect(chain.calls).toHaveLength(0);
    expect(result.onchainFailed).toBe(false);
  });

  it('reports a second failure and leaves the activity as it was', async () => {
    const saved = await savedButNotOnchain();
    chain.failures.recordActivity = new Error('still down');

    const result = await retryOnChain(saved, deps());

    expect(result.onchainFailed).toBe(true);
    expect(store.get(saved.id).onchainActivityId).toBeUndefined();
  });

  it('keeps the activity on this device when there is no wallet', async () => {
    const saved = await savedButNotOnchain();

    const result = await retryOnChain(saved, deps({ chain: null }));

    expect(result.onchainFailed).toBe(false);
    expect(chain.calls).toHaveLength(0);
  });
});

describe('recording while a retry could start', () => {
  it('refuses a retry for an activity that is still being recorded, so it is never recorded twice', async () => {
    let release = () => {};
    chain.recordGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const saving = savePostRun(INPUT, deps());
    await vi.waitFor(() => expect(chain.callsTo('recordActivity')).toHaveLength(1));
    expect(isSyncing('id-1')).toBe(true);

    const result = await retryOnChain(store.get('id-1'), deps());

    expect(result.steps.record).toEqual({ status: 'skipped', reason: 'already syncing' });
    expect(chain.callsTo('recordActivity')).toHaveLength(1);

    release();
    await saving;
    expect(isSyncing('id-1')).toBe(false);
  });

  it('frees the activity again when the sync throws', async () => {
    chain.failures.recordActivity = new Error('rpc down');

    await savePostRun(INPUT, deps());

    expect(isSyncing('id-1')).toBe(false);
  });
});

describe('telling the caller the activity is safe on the device', () => {
  it('calls onSaved with the stored activity while the chain is still working', async () => {
    let release: () => void = () => {};
    chain.recordGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const saved: string[] = [];

    const pending = savePostRun(
      INPUT,
      deps({ onSaved: (activity) => saved.push(`${activity.id}:${store.get(activity.id).name}`) })
    );
    // Let the pipeline run up to the gated chain call.
    await vi.waitFor(() => expect(chain.callsTo('recordActivity')).toHaveLength(1));

    expect(saved).toEqual(['id-1:Evening Run']);
    release();
    await pending;
  });

  it('does not call onSaved when the recording is refused', async () => {
    const onSaved = vi.fn();
    await expect(savePostRun({ ...INPUT, polyline: '' }, deps({ onSaved }))).rejects.toBeInstanceOf(
      EmptyRecordingError
    );
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('remembering that an activity was imported', () => {
  it('keeps the imported flag on the saved activity, and leaves it off for a recording', async () => {
    const imported = await savePostRun(
      { ...INPUT, isManual: true, isImported: true, polyline: '' },
      deps()
    );
    expect(imported.activity.isImported).toBe(true);
    expect(store.get('id-1').isImported).toBe(true);

    const recorded = await savePostRun(INPUT, deps());
    expect(recorded.activity.isImported).toBeUndefined();
  });
});

describe('save progress', () => {
  const phasesFor = async (input: Partial<PostRunInput>) => {
    const phases: string[] = [];
    await savePostRun({ ...INPUT, ...input }, deps({ onProgress: (phase) => phases.push(phase) }));
    return phases;
  };

  it('reports the photo upload, then the rest of the save', async () => {
    expect(await phasesFor({ photos: ['file:///a.jpg'] })).toEqual(['uploading-photos', 'saving']);
  });

  it('goes straight to saving when there is nothing to upload', async () => {
    expect(await phasesFor({})).toEqual(['saving']);
    expect(await phasesFor({ photos: ['https://cdn.test/a.jpg'] })).toEqual(['saving']);
  });

  it('does not claim an upload for an Only Me activity, whose photos stay on the phone', async () => {
    expect(await phasesFor({ photos: ['file:///a.jpg'], privacy: 'only_me' })).toEqual(['saving']);
  });

  it('saves the same without a listener', async () => {
    const result = await savePostRun({ ...INPUT, photos: ['file:///a.jpg'] }, deps());
    expect(result.activity.images).toBeDefined();
  });
});
