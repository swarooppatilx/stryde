import type { ActivityType } from '@/types';
import { haversineDistance } from '@/utils/geo';
import type { RoutePoint } from '@/utils/route';

/**
 * A route being planned: the points the athlete tapped, and one leg between each pair. A leg is the
 * line to draw (snapped to a road, or straight), or null while it still needs a snap. Keeping the
 * legs beside the points means moving or deleting one point only invalidates the legs it touches.
 */
export interface RoutePlan {
  waypoints: RoutePoint[];
  legs: (RoutePoint[] | null)[];
}

export interface EditOptions {
  /** False in manual mode: legs are drawn straight and never sent for snapping. */
  snap?: boolean;
}

export const emptyPlan = (): RoutePlan => ({ waypoints: [], legs: [] });

const sameLeg = (a: RoutePoint | undefined, b: RoutePoint | undefined) =>
  !!a && !!b && a[0] === b[0] && a[1] === b[1];

const straight = (a: RoutePoint, b: RoutePoint): RoutePoint[] => [a, b];

function legBetween(a: RoutePoint, b: RoutePoint, snap: boolean): RoutePoint[] | null {
  return snap ? null : straight(a, b);
}

export function addPoint(plan: RoutePlan, point: RoutePoint, { snap = true }: EditOptions = {}) {
  const last = plan.waypoints.at(-1);
  return {
    waypoints: [...plan.waypoints, point],
    legs: last ? [...plan.legs, legBetween(last, point, snap)] : plan.legs,
  };
}

export function movePoint(
  plan: RoutePlan,
  index: number,
  point: RoutePoint,
  { snap = true }: EditOptions = {}
): RoutePlan {
  if (index < 0 || index >= plan.waypoints.length) return plan;
  const waypoints = plan.waypoints.map((p, i) => (i === index ? point : p));
  const legs = plan.legs.map((leg, i) => {
    // Leg i joins waypoints i and i+1; only the two touching `index` change.
    if (i !== index - 1 && i !== index) return leg;
    return legBetween(waypoints[i] as RoutePoint, waypoints[i + 1] as RoutePoint, snap);
  });
  return { waypoints, legs };
}

export function deletePoint(
  plan: RoutePlan,
  index: number,
  { snap = true }: EditOptions = {}
): RoutePlan {
  if (index < 0 || index >= plan.waypoints.length) return plan;
  const waypoints = plan.waypoints.filter((_, i) => i !== index);
  if (waypoints.length < 2) return { waypoints, legs: [] };
  const legs = [...plan.legs];
  if (index === 0) {
    legs.shift();
  } else if (index === plan.waypoints.length - 1) {
    legs.pop();
  } else {
    // The two legs around a removed middle point become one leg between its neighbours.
    legs.splice(
      index - 1,
      2,
      legBetween(waypoints[index - 1] as RoutePoint, waypoints[index] as RoutePoint, snap)
    );
  }
  return { waypoints, legs };
}

export function reversePlan(plan: RoutePlan): RoutePlan {
  return {
    waypoints: [...plan.waypoints].reverse(),
    legs: [...plan.legs].reverse().map((leg) => (leg ? [...leg].reverse() : leg)),
  };
}

/** Every leg back to "needs a snap", for when the network changes (walking to cycling). */
export function resnapPlan(plan: RoutePlan): RoutePlan {
  if (plan.legs.length === 0) return plan;
  return { ...plan, legs: plan.legs.map(() => null) };
}

/** The legs waiting for a snap, with the two points each one routes between. */
export function legsToSnap(plan: RoutePlan): { index: number; from: RoutePoint; to: RoutePoint }[] {
  const out: { index: number; from: RoutePoint; to: RoutePoint }[] = [];
  plan.legs.forEach((leg, index) => {
    if (leg === null) {
      out.push({
        index,
        from: plan.waypoints[index] as RoutePoint,
        to: plan.waypoints[index + 1] as RoutePoint,
      });
    }
  });
  return out;
}

/**
 * Stores a snapped line, but only if the leg still joins the same two points: a reply that arrives
 * after the athlete moved a point would otherwise redraw a road they have already left.
 */
export function setLeg(
  plan: RoutePlan,
  index: number,
  from: RoutePoint,
  to: RoutePoint,
  line: RoutePoint[]
): RoutePlan {
  if (index < 0 || index >= plan.legs.length) return plan;
  if (!sameLeg(plan.waypoints[index], from) || !sameLeg(plan.waypoints[index + 1], to)) return plan;
  return { ...plan, legs: plan.legs.map((leg, i) => (i === index ? line : leg)) };
}

/** The whole line to draw: snapped legs where there are any, straight where a leg is still waiting. */
export function planLine(plan: RoutePlan): RoutePoint[] {
  const first = plan.waypoints[0];
  if (!first) return [];
  if (plan.legs.length === 0) return [first];
  const line: RoutePoint[] = [];
  plan.legs.forEach((leg, i) => {
    const a = plan.waypoints[i] as RoutePoint;
    const b = plan.waypoints[i + 1] as RoutePoint;
    for (const point of leg ?? straight(a, b)) {
      // A leg starts where the last one ended: keep that point once.
      if (!sameLeg(line.at(-1), point)) line.push(point);
    }
  });
  return line;
}

/** Length in metres of the line that is drawn. */
export function planDistance(plan: RoutePlan): number {
  const line = planLine(plan);
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as RoutePoint;
    const b = line[i] as RoutePoint;
    total += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return total;
}

/** Which network a sport is snapped to: cyclists get bike-suitable roads, everyone else walkable paths. */
export const routingProfileFor = (sport: ActivityType): 'foot' | 'bike' =>
  sport === 'ride' ? 'bike' : 'foot';
