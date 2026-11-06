import { describe, expect, it } from 'vitest';
import {
  addPoint,
  deletePoint,
  emptyPlan,
  legsToSnap,
  movePoint,
  planDistance,
  planLine,
  resnapPlan,
  reversePlan,
  routingProfileFor,
  setLeg,
} from '@/utils/routePlan';

const A: [number, number] = [73.85, 18.52];
const B: [number, number] = [73.86, 18.52];
const C: [number, number] = [73.86, 18.53];
const D: [number, number] = [73.87, 18.53];

const SNAPPED_AB: [number, number][] = [A, [73.855, 18.5205], B];

describe('addPoint', () => {
  it('starts with no legs, then adds one leg to snap per extra point', () => {
    let plan = addPoint(emptyPlan(), A);
    expect(plan.waypoints).toEqual([A]);
    expect(plan.legs).toEqual([]);
    plan = addPoint(plan, B);
    expect(plan.legs).toEqual([null]);
  });

  it('draws the new leg straight in manual mode instead of asking for a snap', () => {
    const plan = addPoint(addPoint(emptyPlan(), A), B, { snap: false });
    expect(plan.legs).toEqual([[A, B]]);
    expect(legsToSnap(plan)).toEqual([]);
  });
});

describe('legsToSnap', () => {
  it('lists each unsnapped leg with the points to route between', () => {
    const plan = addPoint(addPoint(addPoint(emptyPlan(), A), B), C);
    expect(legsToSnap(plan)).toEqual([
      { index: 0, from: A, to: B },
      { index: 1, from: B, to: C },
    ]);
  });
});

describe('setLeg', () => {
  const plan = addPoint(addPoint(emptyPlan(), A), B);

  it('stores the snapped line for the leg it was asked for', () => {
    expect(setLeg(plan, 0, A, B, SNAPPED_AB).legs[0]).toEqual(SNAPPED_AB);
  });

  it('drops an answer for points that have moved since the request, so a slow reply cannot redraw the wrong road', () => {
    const moved = movePoint(plan, 1, C);
    expect(setLeg(moved, 0, A, B, SNAPPED_AB)).toBe(moved);
  });

  it('ignores an index that no longer exists', () => {
    expect(setLeg(plan, 5, A, B, SNAPPED_AB)).toBe(plan);
  });
});

describe('movePoint', () => {
  it('re-routes only the legs touching the moved point', () => {
    let plan = addPoint(addPoint(addPoint(emptyPlan(), A), B), C);
    plan = setLeg(setLeg(plan, 0, A, B, SNAPPED_AB), 1, B, C, [B, C]);

    const moved = movePoint(plan, 2, D);

    expect(moved.waypoints[2]).toEqual(D);
    expect(moved.legs[0]).toEqual(SNAPPED_AB);
    expect(moved.legs[1]).toBeNull();
  });

  it('redraws straight in manual mode', () => {
    const plan = addPoint(addPoint(emptyPlan(), A), B);
    expect(movePoint(plan, 1, C, { snap: false }).legs).toEqual([[A, C]]);
  });
});

describe('deletePoint', () => {
  const full = () => {
    let plan = addPoint(addPoint(addPoint(addPoint(emptyPlan(), A), B), C), D);
    plan = setLeg(plan, 0, A, B, SNAPPED_AB);
    return plan;
  };

  it('joins the neighbours with one new leg to snap when a middle point goes', () => {
    const plan = deletePoint(full(), 1);
    expect(plan.waypoints).toEqual([A, C, D]);
    expect(plan.legs).toHaveLength(2);
    expect(plan.legs[0]).toBeNull();
  });

  it('drops the first or last leg with an end point', () => {
    const first = deletePoint(full(), 0);
    expect(first.waypoints).toEqual([B, C, D]);
    expect(first.legs).toEqual([null, null]);
    const last = deletePoint(full(), 3);
    expect(last.waypoints).toEqual([A, B, C]);
    expect(last.legs[0]).toEqual(SNAPPED_AB);
  });

  it('ends with no legs once a single point is left, and with nothing for an unknown index', () => {
    const two = addPoint(addPoint(emptyPlan(), A), B);
    expect(deletePoint(two, 0).legs).toEqual([]);
    expect(deletePoint(two, 9)).toBe(two);
  });
});

describe('reversePlan', () => {
  it('reverses the points and the direction of every snapped leg', () => {
    let plan = addPoint(addPoint(emptyPlan(), A), B);
    plan = setLeg(plan, 0, A, B, SNAPPED_AB);
    const reversed = reversePlan(plan);
    expect(reversed.waypoints).toEqual([B, A]);
    expect(reversed.legs[0]).toEqual([...SNAPPED_AB].reverse());
  });
});

describe('planLine and planDistance', () => {
  it('joins snapped and straight legs into one line without repeating the shared point', () => {
    let plan = addPoint(addPoint(addPoint(emptyPlan(), A), B), C);
    plan = setLeg(plan, 0, A, B, SNAPPED_AB);
    expect(planLine(plan)).toEqual([...SNAPPED_AB, C]);
  });

  it('keeps the whole snapped leg, including where it leaves the road the point was snapped to', () => {
    const onRoad: [number, number][] = [
      [73.8501, 18.5201],
      [73.855, 18.5205],
      [73.8599, 18.5199],
    ];
    const plan = setLeg(addPoint(addPoint(emptyPlan(), A), B), 0, A, B, onRoad);
    expect(planLine(plan)).toEqual(onRoad);
  });

  it('uses a straight line for a leg still waiting to be snapped, so the map is never blank', () => {
    const plan = addPoint(addPoint(emptyPlan(), A), B);
    expect(planLine(plan)).toEqual([A, B]);
  });

  it('measures the line that is drawn, so a winding road is longer than the straight line', () => {
    const straight = addPoint(addPoint(emptyPlan(), A), B);
    const winding = setLeg(straight, 0, A, B, [A, [73.855, 18.53], B]);
    expect(planDistance(winding)).toBeGreaterThan(planDistance(straight) * 1.5);
  });

  it('is empty for no points and a lone point', () => {
    expect(planLine(emptyPlan())).toEqual([]);
    expect(planLine(addPoint(emptyPlan(), A))).toEqual([A]);
    expect(planDistance(addPoint(emptyPlan(), A))).toBe(0);
  });
});

describe('routingProfileFor', () => {
  it('routes a ride along cycle-friendly roads and everything else along walkable paths', () => {
    expect(routingProfileFor('ride')).toBe('bike');
    for (const sport of ['run', 'walk', 'hike'] as const) {
      expect(routingProfileFor(sport)).toBe('foot');
    }
  });
});

describe('resnapPlan', () => {
  it('sends every leg to be snapped again, for a change of sport, keeping the points', () => {
    let plan = addPoint(addPoint(addPoint(emptyPlan(), A), B), C);
    plan = setLeg(setLeg(plan, 0, A, B, SNAPPED_AB), 1, B, C, [B, C]);

    const again = resnapPlan(plan);

    expect(again.waypoints).toEqual([A, B, C]);
    expect(again.legs).toEqual([null, null]);
  });

  it('leaves a plan without legs as it is', () => {
    const one = addPoint(emptyPlan(), A);
    expect(resnapPlan(one)).toBe(one);
  });
});
