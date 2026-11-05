import type { ActivityStream } from '@/types';

export interface GradientStop {
  /** How far along the route's line, 0 at the start and 1 at the end. */
  progress: number;
  /** How fast the athlete was there, 0 at their slowest and 1 at their fastest. */
  t: number;
}

/**
 * Where along the route the athlete was slow or fast, for colouring the line. Null when there is
 * nothing to show: no distances were kept, there is one point, or the speed never changed.
 */
export function paceGradientStops(stream: ActivityStream, maxStops: number): GradientStop[] | null {
  const { speed, d } = stream;
  if (!d || d.length < 2 || speed.length !== d.length) return null;
  const total = d.at(-1) ?? 0;
  const slow = Math.min(...speed);
  const fast = Math.max(...speed);
  if (total <= 0 || fast <= slow) return null;

  const step = Math.max(1, Math.ceil(d.length / maxStops));
  const stops: GradientStop[] = [];
  const add = (i: number) => {
    const progress = Math.min(1, Math.max(0, (d[i] as number) / total));
    const last = stops.at(-1);
    // Progress must rise, or the map rejects the style; a stop at the same spot adds nothing.
    if (last && progress <= last.progress) return;
    stops.push({ progress, t: ((speed[i] as number) - slow) / (fast - slow) });
  };
  for (let i = 0; i < d.length; i += step) add(i);
  const finalIndex = d.length - 1;
  if (finalIndex % step !== 0 || stops.at(-1)?.progress !== 1) add(finalIndex);
  return stops.length >= 2 ? stops : null;
}

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** A colour along a ramp of two or more `#rrggbb` stops, evenly spaced; `t` is 0 to 1. */
export function rampColor(t: number, colors: readonly string[]): string {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const from = colors[index] as string;
  const to = colors[index + 1] as string;
  const mix = scaled - index;
  const blended = [0, 1, 2].map(
    (c) => channel(from, c) + (channel(to, c) - channel(from, c)) * mix
  );
  return `#${blended.map(hex2).join('')}`;
}

/** The route line's colour stops for a recording: slow to fast along `colors`. Null when there is nothing to show. */
export function paceColorStops(
  stream: ActivityStream | undefined,
  colors: readonly string[],
  maxStops = 24
): Array<{ progress: number; color: string }> | null {
  if (!stream) return null;
  const stops = paceGradientStops(stream, maxStops);
  return stops ? stops.map((s) => ({ progress: s.progress, color: rampColor(s.t, colors) })) : null;
}
