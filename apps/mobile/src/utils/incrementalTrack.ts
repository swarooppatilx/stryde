import type { Location } from '@/types';
import { haversineDistance, OutlierFilter, SMOOTHING_HALF_WINDOW, smoothAt } from './geo';

const leg = (a: Location, b: Location) =>
  haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);

/** Live-track distance updated one fix at a time: equals cleaning the whole track (outliers out, smoothed) and summing legs, at constant cost per fix. A point is final once two fixes follow it; the last two are recomputed on each read. */
export class IncrementalTrack {
  private readonly filter: OutlierFilter;
  private kept: Location[] = [];
  private fedCount = 0;
  /** Length of the kept fixes as they are, used while there are too few to smooth. */
  private rawLength = 0;
  /** Points whose smoothed position is final, and the length of the path through them. */
  private finalCount = 0;
  private finalLength = 0;
  private lastFinal: Location | undefined;

  constructor(maxSpeedMs: number, maxAccuracyM?: number) {
    this.filter = new OutlierFilter(maxSpeedMs, maxAccuracyM);
  }

  /** How many fixes have been given to it, kept or not. */
  get fed(): number {
    return this.fedCount;
  }

  add(location: Location): void {
    this.fedCount++;
    if (!this.filter.accept(location)) return;

    const previous = this.kept.at(-1);
    this.kept.push(location);
    if (previous) this.rawLength += leg(previous, location);

    // Smoothing starts once there are three kept fixes; a point is final when two follow it.
    if (this.kept.length < 3) return;
    while (this.finalCount <= this.kept.length - 1 - SMOOTHING_HALF_WINDOW) {
      const smoothed = smoothAt(this.kept, this.finalCount);
      if (this.lastFinal) this.finalLength += leg(this.lastFinal, smoothed);
      this.lastFinal = smoothed;
      this.finalCount++;
    }
  }

  /** Meters along the cleaned, smoothed track so far. */
  get length(): number {
    if (this.kept.length < 3) return this.rawLength;
    let total = this.finalLength;
    let previous = this.lastFinal;
    for (let i = this.finalCount; i < this.kept.length; i++) {
      const smoothed = smoothAt(this.kept, i);
      if (previous) total += leg(previous, smoothed);
      previous = smoothed;
    }
    return total;
  }
}
