import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useHealthStore } = await import('@/stores/healthStore');

beforeEach(() => {
  installFakePlatform();
  useHealthStore.getState().reset();
});

describe('health store auto sync', () => {
  it('starts off with no result', () => {
    expect(useHealthStore.getState()).toMatchObject({
      autoSync: false,
      lastAutoSync: null,
      lastAutoSyncAttemptAt: null,
    });
  });

  it('keeps the setting and last result until reset', () => {
    const s = useHealthStore.getState();
    s.setAutoSync(true);
    s.setLastAutoSync({ at: 5, imported: 2, skipped: 1 });
    s.markAutoSyncAttempt(5);

    expect(useHealthStore.getState()).toMatchObject({
      autoSync: true,
      lastAutoSync: { at: 5, imported: 2, skipped: 1 },
      lastAutoSyncAttemptAt: 5,
    });

    useHealthStore.getState().reset();

    expect(useHealthStore.getState()).toMatchObject({ autoSync: false, lastAutoSync: null });
  });

  it('migrates a version 1 save without losing what was imported', () => {
    const migrate = useHealthStore.persist.getOptions().migrate;
    const old = { watermark: 9, imported: ['a'], lastImportAt: 7 };

    expect(migrate?.(old, 1)).toEqual({
      ...old,
      autoSync: false,
      lastAutoSync: null,
      lastAutoSyncAttemptAt: null,
    });
  });
});
