import { describe, expect, it } from 'vitest';
import type { Activity, Gear, GearComponent } from '@/types';
import {
  componentStatus,
  componentUsage,
  GEAR_NEAR_RATIO,
  gearAlertLevel,
  parsePositive,
} from '@/utils/gearComponents';

const DAY = 86_400_000;
const act = (distance: number, duration: number, daysAgo: number, gearId = 'g1') =>
  ({ distance, duration, gearId, createdAt: new Date(10 * DAY - daysAgo * DAY) }) as Activity;
const chain: GearComponent = {
  id: 'c1',
  name: 'Chain',
  installedAt: 5 * DAY,
  budgetDistance: 100_000,
};

describe('componentUsage', () => {
  it('counts only activities on the same gear since the install date', () => {
    const usage = componentUsage(chain, 'g1', [
      act(30_000, 3_600_000, 1),
      act(20_000, 1_800_000, 4),
      act(99_000, 1000, 8),
      act(40_000, 1000, 1, 'g2'),
    ]);
    expect(usage).toEqual({ distance: 50_000, time: 5_400_000 });
  });

  it('counts an activity on the install day itself', () => {
    expect(componentUsage(chain, 'g1', [act(1000, 60_000, 5)]).distance).toBe(1000);
  });
});

describe('componentStatus', () => {
  it('is ok below 90% of the budget', () => {
    expect(componentStatus(chain, { distance: 89_000, time: 0 }).level).toBe('ok');
  });

  it('warns from 90% and flags over at 100%', () => {
    expect(GEAR_NEAR_RATIO).toBe(0.9);
    expect(componentStatus(chain, { distance: 90_000, time: 0 }).level).toBe('near');
    expect(componentStatus(chain, { distance: 100_000, time: 0 })).toMatchObject({
      level: 'over',
      ratio: 1,
    });
  });

  it('uses whichever budget is further along', () => {
    const both = { ...chain, budgetTime: 10_000 };
    expect(componentStatus(both, { distance: 10_000, time: 9500 }).level).toBe('near');
  });

  it('is ok when no budget is set', () => {
    const none = { id: 'c', name: 'x', installedAt: 0 };
    expect(componentStatus(none, { distance: 1e9, time: 1e9 })).toEqual({ ratio: 0, level: 'ok' });
  });
});

describe('gearAlertLevel', () => {
  const gear: Gear = {
    id: 'g1',
    name: 'Bike',
    kind: 'bike',
    startingDistance: 0,
    components: [chain, { ...chain, id: 'c2', budgetDistance: 1_000_000 }],
  };

  it('is the worst level across the components', () => {
    expect(gearAlertLevel(gear, [act(95_000, 1, 1)])).toBe('near');
    expect(gearAlertLevel(gear, [act(120_000, 1, 1)])).toBe('over');
    expect(gearAlertLevel(gear, [])).toBe('ok');
  });

  it('is ok for gear without components', () => {
    expect(gearAlertLevel({ ...gear, components: undefined }, [act(1e6, 1, 1)])).toBe('ok');
  });
});

describe('parsePositive', () => {
  it('reads dots and commas and rejects blank, zero and negatives', () => {
    expect(parsePositive('1,5')).toBe(1.5);
    expect(parsePositive('300')).toBe(300);
    expect(parsePositive('')).toBeUndefined();
    expect(parsePositive('0')).toBeUndefined();
    expect(parsePositive('-4')).toBeUndefined();
  });
});
