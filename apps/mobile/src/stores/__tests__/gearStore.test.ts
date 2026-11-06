import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useGearStore, migrateGearState } = await import('@/stores/gearStore');

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

  it('adds, replaces and removes a component', () => {
    const { id } = useGearStore.getState().addGear({ name: 'Road bike', kind: 'bike' });
    useGearStore
      .getState()
      .addComponent(id, { name: ' Chain ', installedAt: 100, budgetDistance: 5_000_000 });
    const [chain] = useGearStore.getState().gear[0]?.components ?? [];
    expect(chain).toMatchObject({ name: 'Chain', installedAt: 100, budgetDistance: 5_000_000 });

    useGearStore.getState().replaceComponent(id, chain?.id ?? '', 900);
    expect(useGearStore.getState().gear[0]?.components?.[0]).toMatchObject({
      installedAt: 900,
      budgetDistance: 5_000_000,
    });

    useGearStore.getState().removeComponent(id, chain?.id ?? '');
    expect(useGearStore.getState().gear[0]?.components).toEqual([]);
  });

  it('migrates version 1 gear to carry an empty component list', () => {
    const old = { gear: [{ id: 'g', name: 'A', kind: 'shoes', startingDistance: 0 }] };
    expect(migrateGearState(old, 1)).toEqual({
      gear: [{ id: 'g', name: 'A', kind: 'shoes', startingDistance: 0, components: [] }],
    });
    expect(migrateGearState({ gear: [] }, 2)).toEqual({ gear: [] });
    expect(useGearStore.persist.getOptions().version).toBe(2);
  });
});
