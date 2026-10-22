import { describe, expect, it } from 'vitest';
import type { Activity, Gear } from '@/types';
import { gearForSport, gearMileage } from '@/utils/gearMileage';

const shoes: Gear = { id: 'g1', name: 'Daily trainers', kind: 'shoes', startingDistance: 50_000 };
const bike: Gear = { id: 'g2', name: 'Road bike', kind: 'bike', startingDistance: 0 };
const run = (distance: number, gearId?: string) => ({ distance, gearId }) as Activity;

describe('gearMileage', () => {
  it('adds the activities that used it to what it had already covered', () => {
    expect(gearMileage(shoes, [run(5000, 'g1'), run(10_000, 'g1'), run(8000, 'g2')])).toBe(65_000);
  });

  it('is just the starting distance with no activities', () => {
    expect(gearMileage(shoes, [])).toBe(50_000);
  });
});

describe('gearForSport', () => {
  it('offers shoes for foot sports and bikes for rides, leaving out retired gear', () => {
    const retired: Gear = { ...shoes, id: 'g3', retired: true };
    expect(gearForSport([shoes, bike, retired], 'run')).toEqual([shoes]);
    expect(gearForSport([shoes, bike, retired], 'ride')).toEqual([bike]);
    expect(gearForSport([shoes, bike], 'yoga')).toEqual([]);
  });
});
