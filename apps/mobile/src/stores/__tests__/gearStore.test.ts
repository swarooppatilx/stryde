import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useGearStore } = await import('@/stores/gearStore');

beforeEach(() => {
  installFakePlatform();
  useGearStore.getState().reset();
});

describe('gear store', () => {
  it('adds gear with a trimmed name and the distance it had already covered', () => {
    const gear = useGearStore
      .getState()
      .addGear({ name: '  Daily trainers ', kind: 'shoes', startingDistance: 120_000 });

    expect(gear).toMatchObject({
      name: 'Daily trainers',
      kind: 'shoes',
      startingDistance: 120_000,
    });
    expect(useGearStore.getState().gear).toEqual([gear]);
  });

  it('retires gear without losing its history', () => {
    const { id } = useGearStore.getState().addGear({ name: 'Old bike', kind: 'bike' });

    useGearStore.getState().retireGear(id);

    expect(useGearStore.getState().gear[0]).toMatchObject({ id, retired: true });
  });

  it('gives each piece of gear its own id', () => {
    const a = useGearStore.getState().addGear({ name: 'A', kind: 'shoes' });
    const b = useGearStore.getState().addGear({ name: 'B', kind: 'shoes' });

    expect(a.id).not.toBe(b.id);
  });
});
