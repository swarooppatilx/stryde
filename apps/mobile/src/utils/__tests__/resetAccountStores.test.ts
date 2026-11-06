import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { resetAccountStores } = await import('@/utils/resetAccountStores');
const { useGearStore } = await import('@/stores/gearStore');
const { useGoalsStore } = await import('@/stores/goalsStore');
const { useRouteStore } = await import('@/stores/routeStore');
const { useBlockStore } = await import('@/stores/blockStore');
const { useHealthStore } = await import('@/stores/healthStore');
const { useMapPrefsStore } = await import('@/stores/mapPrefsStore');
const { useSensorStore } = await import('@/stores/sensorStore');
const { useRecordUiStore } = await import('@/stores/recordUiStore');
const { useRecentSearchStore } = await import('@/stores/recentSearchStore');
const { useNotificationPrefsStore, isEnabled } = await import('@/stores/notificationPrefsStore');

beforeEach(() => installFakePlatform());

describe('resetAccountStores', () => {
  it('clears what the previous account kept on this device, so the next one starts clean', () => {
    useGearStore.getState().addGear({ name: 'Trainers', kind: 'shoes' });
    useRouteStore
      .getState()
      .save({ name: 'Loop', polyline: '1,2;3,4', distance: 1000, sport: 'run' });
    useGoalsStore.getState().addGoal({ metric: 'distance', period: 'week', target: 1000 });
    useBlockStore.getState().block('0xabc');
    useBlockStore.getState().hideReported({ kind: 'comment', id: 'c1', ownerId: '0xdef' });
    useHealthStore.getState().write({ watermark: 123, imported: ['w1'] });
    useMapPrefsStore.getState().setLayer('routes', true);
    useRecordUiStore.getState().setTrackLaps(false);
    useSensorStore.getState().pair('heartRate', { id: 'strap', name: 'Strap' }, 1);
    useRecentSearchStore.getState().remember({ kind: 'user', id: '0xabc', label: 'A' });
    useNotificationPrefsStore.getState().setEnabled('kudos', false);

    resetAccountStores();

    expect(useGearStore.getState().gear).toEqual([]);
    expect(useGoalsStore.getState()).toMatchObject({ goals: [], seeded: false, touched: false });
    expect(useRouteStore.getState().routes).toEqual([]);
    expect(useBlockStore.getState().blocked).toEqual([]);
    expect(useBlockStore.getState().reportedHidden).toEqual({ activities: [], comments: [] });
    expect(useHealthStore.getState()).toMatchObject({ watermark: null, imported: [] });
    expect(useMapPrefsStore.getState().showRoutes).toBe(false);
    expect(useRecordUiStore.getState().trackLaps).toBe(true);
    expect(useSensorStore.getState().paired.heartRate).toBeNull();
    expect(useRecentSearchStore.getState().recents).toEqual([]);
    expect(isEnabled('kudos')).toBe(true);
  });

  it('drops an unfinished recording so the next account is not offered it', async () => {
    const { getPlatform } = await import('@/platform');
    const { TRACKING_STORAGE_KEY } = await import('@/utils/recoverableRun');
    const { storage } = getPlatform();
    await storage.setItem(TRACKING_STORAGE_KEY, '{"startTime":1}');

    resetAccountStores();
    await vi.waitFor(async () => expect(await storage.getItem(TRACKING_STORAGE_KEY)).toBeNull());
  });

  it('covers every store that can be reset, so a new one is not forgotten', () => {
    const dir = join(__dirname, '..', '..', 'stores');
    const resettable = readdirSync(dir)
      .filter((f) => f.endsWith('Store.ts'))
      .filter((f) => /reset:\s*\(\)|clear:\s*\(\)/.test(readFileSync(join(dir, f), 'utf8')))
      .map((f) => f.replace('.ts', ''));
    const source = readFileSync(join(__dirname, '..', 'resetAccountStores.ts'), 'utf8');

    for (const store of resettable) expect(source, store).toContain(store);
  });
});
