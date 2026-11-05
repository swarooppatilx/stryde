import { describe, expect, it } from 'vitest';
import {
  parseSnapshot,
  resetData,
  restoreSnapshot,
  SNAPSHOT_KEYS,
  takeSnapshot,
} from '@/backends/snapshot';
import { MemoryStorage } from '@/platform/fakes';

async function filled() {
  const storage = new MemoryStorage();
  await storage.setItem('@stryde/activities', '{"a":1}');
  await storage.setItem('stryde-social', '{"b":2}');
  await storage.setItem('@stryde/outbox', '[]');
  await storage.setItem('unrelated-key', 'x');
  return storage;
}

describe('takeSnapshot', () => {
  it('captures the app data keys that exist, for the profile it was taken on', async () => {
    const snapshot = await takeSnapshot({ storage: await filled(), profile: 'local', now: 5 });

    expect(snapshot).toMatchObject({ version: 1, profile: 'local', takenAt: 5 });
    expect(Object.keys(snapshot.entries).sort()).toEqual(
      ['@stryde/activities', '@stryde/outbox', 'stryde-social'].sort()
    );
  });

  it('leaves out keys that are not app data', async () => {
    const snapshot = await takeSnapshot({ storage: await filled(), profile: 'live', now: 0 });
    expect(snapshot.entries['unrelated-key']).toBeUndefined();
  });
});

describe('parseSnapshot', () => {
  it('reads back what takeSnapshot produced', async () => {
    const snapshot = await takeSnapshot({ storage: await filled(), profile: 'local', now: 5 });
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('rejects anything that is not a snapshot', () => {
    expect(parseSnapshot('nope')).toBeNull();
    expect(parseSnapshot('{}')).toBeNull();
    expect(
      parseSnapshot(JSON.stringify({ version: 2, profile: 'live', takenAt: 0, entries: {} }))
    ).toBeNull();
    expect(
      parseSnapshot(JSON.stringify({ version: 1, profile: 'live', takenAt: 0, entries: { x: 1 } }))
    ).toBeNull();
  });

  it('ignores keys that are not app data', () => {
    const text = JSON.stringify({
      version: 1,
      profile: 'local',
      takenAt: 0,
      entries: { evil: 'x', 'stryde-social': '{}' },
    });
    expect(Object.keys(parseSnapshot(text)?.entries ?? {})).toEqual(['stryde-social']);
  });
});

describe('restoreSnapshot', () => {
  it('replaces the profile data with the snapshot, removing what the snapshot did not have', async () => {
    const source = await filled();
    const snapshot = await takeSnapshot({ storage: source, profile: 'local', now: 0 });
    const target = new MemoryStorage();
    await target.setItem('@stryde/activities', 'old');
    await target.setItem('@stryde/territory-polygons', 'old');

    const result = await restoreSnapshot({ storage: target, snapshot, profile: 'local' });

    expect(result).toEqual({ ok: true });
    expect(await target.getItem('@stryde/activities')).toBe('{"a":1}');
    expect(await target.getItem('@stryde/territory-polygons')).toBeNull();
  });

  it('refuses a snapshot from another profile, whose data lives under different keys', async () => {
    const snapshot = await takeSnapshot({ storage: await filled(), profile: 'live', now: 0 });
    const result = await restoreSnapshot({
      storage: new MemoryStorage(),
      snapshot,
      profile: 'local',
    });

    expect(result).toEqual({ ok: false, error: 'This snapshot was taken on the live profile.' });
  });
});

describe('resetData', () => {
  it('removes every app data key and nothing else', async () => {
    const storage = await filled();
    await resetData(storage);

    for (const key of SNAPSHOT_KEYS) expect(await storage.getItem(key)).toBeNull();
    expect(await storage.getItem('unrelated-key')).toBe('x');
  });
});
