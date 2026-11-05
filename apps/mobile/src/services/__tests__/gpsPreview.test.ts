import { beforeEach, describe, expect, it, vi } from 'vitest';
import { at, FakeLocationSource, PUNE, straightTrack } from '@/platform/fakes';
import { createGpsPreview } from '@/services/gpsPreview';

let location: FakeLocationSource;

const fixes = () => straightTrack({ from: PUNE, speedMps: 3, durationS: 5 });

beforeEach(() => {
  location = new FakeLocationSource();
});

describe('gps preview', () => {
  it('shows the newest fix to subscribers once started', async () => {
    const preview = createGpsPreview({ location });
    const listener = vi.fn();
    preview.subscribe(listener);

    await preview.start();
    expect(preview.getSnapshot()).toBeNull();

    location.emit(at(fixes(), 0));
    location.emit(at(fixes(), 1));

    expect(preview.getSnapshot()).toEqual(at(fixes(), 1));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('never prompts: without permission it stays quiet', async () => {
    location.permission = { granted: false, canAskAgain: true };
    const preview = createGpsPreview({ location });

    await preview.start();

    expect(location.requestCount).toBe(0);
    expect(location.activeWatchers).toBe(0);
  });

  it('watches once however often it is started', async () => {
    const preview = createGpsPreview({ location });

    await Promise.all([preview.start(), preview.start()]);
    await preview.start();

    expect(location.activeWatchers).toBe(1);
  });

  it('stops watching and forgets the fix', async () => {
    const preview = createGpsPreview({ location });
    await preview.start();
    location.emit(at(fixes(), 0));

    preview.stop();

    expect(location.activeWatchers).toBe(0);
    expect(preview.getSnapshot()).toBeNull();
  });

  it('drops a watcher that arrives after stop', async () => {
    const preview = createGpsPreview({ location });

    const started = preview.start();
    preview.stop();
    await started;

    expect(location.activeWatchers).toBe(0);
  });

  it('can start again after stopping', async () => {
    const preview = createGpsPreview({ location });
    await preview.start();
    preview.stop();

    await preview.start();
    location.emit(at(fixes(), 2));

    expect(location.activeWatchers).toBe(1);
    expect(preview.getSnapshot()).toEqual(at(fixes(), 2));
  });

  it('watches once when restarted while an earlier start is still settling', async () => {
    const preview = createGpsPreview({ location });

    const first = preview.start();
    preview.stop();
    const second = preview.start();
    await first;
    const third = preview.start();
    await Promise.all([second, third]);

    expect(location.activeWatchers).toBe(1);
  });

  it('stays quiet when the GPS is switched off, instead of throwing', async () => {
    location.watch = async () => {
      throw new Error('Location provider is unavailable');
    };
    const preview = createGpsPreview({ location });

    await expect(preview.start()).resolves.toBeUndefined();

    expect(preview.getSnapshot()).toBeNull();
  });

  it('can try again after a failed start', async () => {
    const watch = location.watch.bind(location);
    location.watch = async () => {
      throw new Error('Location provider is unavailable');
    };
    const preview = createGpsPreview({ location });
    await preview.start();

    location.watch = watch;
    await preview.start();

    expect(location.activeWatchers).toBe(1);
  });
});
