import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useSensorStore, DEFAULT_WHEEL_MM, clampWheelMm, wheelMmFor } = await import(
  '@/stores/sensorStore'
);

beforeEach(() => {
  installFakePlatform();
  useSensorStore.getState().reset();
});

describe('sensor store', () => {
  it('starts with nothing paired and auto-connect on', () => {
    const s = useSensorStore.getState();
    expect(s.paired).toEqual({ heartRate: null, power: null, speedCadence: null });
    expect(s.autoConnect).toBe(true);
    expect(s.defaultWheelMm).toBe(DEFAULT_WHEEL_MM);
  });

  it('pairs one sensor per kind and replaces the previous one', () => {
    const { pair } = useSensorStore.getState();
    pair('heartRate', { id: 'a', name: 'Strap A' }, 100);
    pair('heartRate', { id: 'b', name: 'Strap B' }, 200);
    expect(useSensorStore.getState().paired.heartRate).toEqual({
      id: 'b',
      name: 'Strap B',
      kind: 'heartRate',
      lastSeen: 200,
    });
  });

  it('keeps the same device under every kind it was paired for', () => {
    const { pair, touch } = useSensorStore.getState();
    pair('power', { id: 'p', name: 'Pedals' }, 1);
    pair('speedCadence', { id: 'p', name: 'Pedals' }, 1);
    touch('p', 50);
    const { paired } = useSensorStore.getState();
    expect([paired.power?.lastSeen, paired.speedCadence?.lastSeen]).toEqual([50, 50]);
  });

  it('forgets a kind without touching the others', () => {
    const { pair, forget } = useSensorStore.getState();
    pair('heartRate', { id: 'a', name: 'Strap' }, 1);
    pair('power', { id: 'p', name: 'Pedals' }, 1);
    forget('heartRate');
    const { paired } = useSensorStore.getState();
    expect(paired.heartRate).toBeNull();
    expect(paired.power?.id).toBe('p');
  });

  it('remembers the auto-connect choice', () => {
    useSensorStore.getState().setAutoConnect(false);
    expect(useSensorStore.getState().autoConnect).toBe(false);
  });

  it('keeps a wheel size per bike and falls back to the default', () => {
    const { setBikeWheelMm, setDefaultWheelMm } = useSensorStore.getState();
    setBikeWheelMm('gravel', 2150);
    setDefaultWheelMm(2096);
    const s = useSensorStore.getState();
    expect(wheelMmFor(s, 'gravel')).toBe(2150);
    expect(wheelMmFor(s, 'road')).toBe(2096);
    expect(wheelMmFor(s, undefined)).toBe(2096);
    s.setBikeWheelMm('gravel', null);
    expect(wheelMmFor(useSensorStore.getState(), 'gravel')).toBe(2096);
  });

  it('keeps wheel sizes inside what a bike can have', () => {
    expect(clampWheelMm(50)).toBe(1000);
    expect(clampWheelMm(9000)).toBe(2600);
    expect(clampWheelMm(2105.4)).toBe(2105);
    expect(clampWheelMm(Number.NaN)).toBe(DEFAULT_WHEEL_MM);
  });

  it('resets everything for the next account', () => {
    const s = useSensorStore.getState();
    s.pair('heartRate', { id: 'a', name: 'Strap' }, 1);
    s.setAutoConnect(false);
    s.setBikeWheelMm('x', 2000);
    s.reset();
    const after = useSensorStore.getState();
    expect(after.paired.heartRate).toBeNull();
    expect(after.autoConnect).toBe(true);
    expect(after.wheelMmByBike).toEqual({});
  });
});
