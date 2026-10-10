import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRecordedRuns,
  dropRecordedRun,
  FINISHED_RUN_KEY,
  peekRecordedRun,
  restoreRecordedRuns,
  setRecordedRunStorage,
  stashRecordedRun,
} from '@/utils/recordedRunHandoff';

beforeEach(() => clearRecordedRuns());

describe('recorded run hand-off', () => {
  it('hands back what was stashed under the id it returned', () => {
    const id = stashRecordedRun({ distance: '5000', polyline: 'x' });

    expect(peekRecordedRun(id)).toEqual({ distance: '5000', polyline: 'x' });
  });

  it('can be read again, so the Save screen survives being rebuilt', () => {
    const id = stashRecordedRun({ a: '1' });

    peekRecordedRun(id);

    expect(peekRecordedRun(id)).toEqual({ a: '1' });
  });

  it('forgets a run once it has been dropped', () => {
    const id = stashRecordedRun({ a: '1' });

    dropRecordedRun(id);

    expect(peekRecordedRun(id)).toBeUndefined();
  });

  it('keeps only the few newest, so abandoned runs do not pile up', () => {
    const ids = Array.from({ length: 6 }, (_, i) => stashRecordedRun({ n: String(i) }));

    expect(peekRecordedRun(ids[0] as string)).toBeUndefined();
    expect(peekRecordedRun(ids[5] as string)).toEqual({ n: '5' });
  });

  it('gives each run its own id', () => {
    expect(stashRecordedRun({})).not.toBe(stashRecordedRun({}));
  });
});

describe('surviving the app being killed', () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: async (k: string) => data.get(k) ?? null,
      setItem: async (k: string, v: string) => void data.set(k, v),
      removeItem: async (k: string) => void data.delete(k),
    };
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('brings a finished run back after a restart, with the same id and data', async () => {
    const disk = memoryStorage();
    setRecordedRunStorage(disk);
    const id = stashRecordedRun({ distance: '8000', polyline: 'abc' });
    await flush();

    clearRecordedRuns(); // the process died: memory is gone, the disk is not

    expect(await restoreRecordedRuns()).toBe(id);
    expect(peekRecordedRun(id)).toEqual({ distance: '8000', polyline: 'abc' });
  });

  it('does not reuse the id of a restored run for the next one', async () => {
    const disk = memoryStorage();
    setRecordedRunStorage(disk);
    const old = stashRecordedRun({ n: 'old' });
    await flush();
    clearRecordedRuns();
    await restoreRecordedRuns();

    const fresh = stashRecordedRun({ n: 'fresh' });

    expect(fresh).not.toBe(old);
    expect(peekRecordedRun(old)).toEqual({ n: 'old' });
  });

  it('forgets a run on disk once it is saved or discarded', async () => {
    const disk = memoryStorage();
    setRecordedRunStorage(disk);
    const id = stashRecordedRun({ a: '1' });
    await flush();

    dropRecordedRun(id);
    await flush();

    expect(disk.data.has(FINISHED_RUN_KEY)).toBe(false);
    clearRecordedRuns();
    expect(await restoreRecordedRuns()).toBeNull();
  });

  it('leaves an unreadable copy on disk instead of deleting someone’s run', async () => {
    const disk = memoryStorage();
    setRecordedRunStorage(disk);
    disk.data.set(FINISHED_RUN_KEY, '{not json');

    expect(await restoreRecordedRuns()).toBeNull();
    expect(disk.data.get(FINISHED_RUN_KEY)).toBe('{not json');
  });

  it('still hands the run to the Save screen when the disk write fails', async () => {
    setRecordedRunStorage({
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
      removeItem: async () => {},
    });

    const id = stashRecordedRun({ a: '1' });
    await flush();

    expect(peekRecordedRun(id)).toEqual({ a: '1' });
  });
});
