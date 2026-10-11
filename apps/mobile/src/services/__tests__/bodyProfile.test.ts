import { beforeEach, describe, expect, it } from 'vitest';
import { FAKE_EPOCH_MS, FakeHealthSource, installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const {
  readBodyFromHealth,
  saveHeight,
  saveMaxHeartRate,
  saveRestingHeartRate,
  saveWeight,
  saveZoneFloors,
} = await import('@/services/bodyProfile');
const { useBodyStore } = await import('@/stores/bodyStore');
const { useProfileStore } = await import('@/stores/profileStore');

beforeEach(() => {
  installFakePlatform();
  useBodyStore.getState().reset();
  useProfileStore.getState().reset();
});

const today = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe('saveWeight', () => {
  it('sets the current weight and adds today to the history', () => {
    saveWeight(70.4);

    expect(useProfileStore.getState().settings.weightKg).toBe(70.4);
    expect(useBodyStore.getState().entries).toEqual([{ day: today(FAKE_EPOCH_MS), kg: 70.4 }]);
  });

  it('does not add a weigh-in when the weight has not changed', () => {
    saveWeight(70);
    useBodyStore.getState().record('2020-01-01', 72);

    saveWeight(70);

    expect(useBodyStore.getState().entries).toHaveLength(2);
  });

  it('clears the weight but keeps what was recorded before', () => {
    saveWeight(70);

    saveWeight(null);

    expect(useProfileStore.getState().settings.weightKg).toBeUndefined();
    expect(useBodyStore.getState().entries).toHaveLength(1);
  });
});

describe('saveHeight', () => {
  it('sets and clears the height', () => {
    saveHeight(175);
    expect(useProfileStore.getState().settings.heightCm).toBe(175);

    saveHeight(null);
    expect(useProfileStore.getState().settings.heightCm).toBeUndefined();
  });
});

describe('readBodyFromHealth', () => {
  const make = () => {
    const health = new FakeHealthSource();
    health.body = { weightKg: 71.4, heightCm: 178, restingHeartRate: 52 };
    return health;
  };

  it('asks for access once and returns weight and height', async () => {
    const health = make();
    expect(await readBodyFromHealth(health)).toEqual({
      status: 'ok',
      weightKg: 71.4,
      heightCm: 178,
      restingHeartRate: 52,
    });
    expect(health.bodyAccess).toBe(true);
  });

  it('does not ask again when access is already granted', async () => {
    const health = make();
    health.bodyAccess = true;
    health.grantBodyOnRequest = false;
    expect((await readBodyFromHealth(health)).status).toBe('ok');
  });

  it('reports a refused permission', async () => {
    const health = make();
    health.grantBodyOnRequest = false;
    expect(await readBodyFromHealth(health)).toEqual({ status: 'denied' });
  });

  it('reports a phone without Health Connect', async () => {
    const health = make();
    health.currentStatus = 'unavailable';
    expect(await readBodyFromHealth(health)).toEqual({ status: 'unavailable' });
  });

  it('reports when nothing usable is recorded', async () => {
    const health = make();
    health.body = {};
    expect(await readBodyFromHealth(health)).toEqual({ status: 'empty' });
  });

  it('is worth returning when only a resting heart rate is recorded', async () => {
    const health = make();
    health.body = { restingHeartRate: 52 };
    expect(await readBodyFromHealth(health)).toEqual({ status: 'ok', restingHeartRate: 52 });
  });
});

describe('saveMaxHeartRate', () => {
  it('keeps the figure, and clears it with null', () => {
    saveMaxHeartRate(192);
    expect(useProfileStore.getState().settings.maxHeartRate).toBe(192);

    saveMaxHeartRate(null);
    expect(useProfileStore.getState().settings.maxHeartRate).toBeUndefined();
  });
});

describe('saveRestingHeartRate', () => {
  it('keeps the figure, and clears it with null', () => {
    saveRestingHeartRate(55);
    expect(useProfileStore.getState().settings.restingHeartRate).toBe(55);

    saveRestingHeartRate(null);
    expect(useProfileStore.getState().settings.restingHeartRate).toBeUndefined();
  });
});

describe('saveZoneFloors', () => {
  it('keeps the athlete’s boundaries, and goes back to the usual ones with null', () => {
    saveZoneFloors([0.5, 0.65, 0.8, 0.96]);
    expect(useProfileStore.getState().settings.hrZoneFloors).toEqual([0.5, 0.65, 0.8, 0.96]);

    saveZoneFloors(null);
    expect(useProfileStore.getState().settings.hrZoneFloors).toBeUndefined();
  });
});
