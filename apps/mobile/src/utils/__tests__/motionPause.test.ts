import { describe, expect, it } from 'vitest';
import { createMotionDetector, type MotionState } from '@/utils/motionPause';

const SAMPLE_MS = 50;

/** Feeds a signal of `seconds` at 20 Hz and returns the state after each sample. */
function feed(
  detector: ReturnType<typeof createMotionDetector>,
  startMs: number,
  seconds: number,
  amplitudeG: number,
  hz = 2.5
): MotionState[] {
  const states: MotionState[] = [];
  for (let t = 0; t < seconds * 1000; t += SAMPLE_MS) {
    const atMs = startMs + t;
    states.push(detector.update(1 + amplitudeG * Math.sin(2 * Math.PI * hz * (atMs / 1000)), atMs));
  }
  return states;
}

describe('createMotionDetector', () => {
  it('does not guess during the first seconds', () => {
    const detector = createMotionDetector();
    const states = feed(detector, 0, 2, 0.4);
    expect(new Set(states)).toEqual(new Set(['unknown']));
  });

  it('reads steady running as moving', () => {
    const detector = createMotionDetector();
    const states = feed(detector, 0, 20, 0.4);
    expect(states.at(-1)).toBe('moving');
    expect(states.slice(80)).not.toContain('still');
  });

  it('notices within a couple of seconds when the athlete stops', () => {
    const detector = createMotionDetector();
    feed(detector, 0, 20, 0.4);
    const states = feed(detector, 20_000, 4, 0.005);
    expect(states.at(-1)).toBe('still');
    const firstStill = states.indexOf('still');
    expect(firstStill).toBeGreaterThanOrEqual(0);
    expect(firstStill * SAMPLE_MS).toBeLessThanOrEqual(2500);
  });

  it('sees movement again after a rest', () => {
    const detector = createMotionDetector();
    feed(detector, 0, 20, 0.4);
    feed(detector, 20_000, 15, 0.005);
    const states = feed(detector, 35_000, 3, 0.4);
    expect(states.at(-1)).toBe('moving');
  });

  it('sees movement again after only a short rest, while the slow average still remembers running', () => {
    const detector = createMotionDetector();
    feed(detector, 0, 20, 0.4);
    feed(detector, 20_000, 6, 0.005);
    const states = feed(detector, 26_000, 2, 0.4);
    expect(states.at(-1)).toBe('moving');
  });

  it('is not woken by the tiny noise of a phone lying on a table', () => {
    const detector = createMotionDetector();
    feed(detector, 0, 20, 0.4);
    feed(detector, 20_000, 15, 0.005);
    const states = feed(detector, 35_000, 20, 0.02, 7);
    expect(states).not.toContain('moving');
  });

  it('calls a phone that has been still from the start still, once warmed up', () => {
    const detector = createMotionDetector();
    const states = feed(detector, 0, 10, 0.004);
    expect(states.at(-1)).toBe('still');
  });

  it('forgets everything on reset', () => {
    const detector = createMotionDetector();
    feed(detector, 0, 10, 0.4);
    detector.reset();
    expect(detector.update(1, 11_000)).toBe('unknown');
  });
});
