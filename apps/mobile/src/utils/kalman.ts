import type { Location } from '@/types';

const EARTH_RADIUS_M = 6371e3;
const DEG = Math.PI / 180;
/** Speed uncertainty (m/s) of a fresh track: anything from standing to a sprint. */
const INITIAL_SPEED_STD_MS = 3;
/** A gap this long (ms) means the old motion says nothing about the new fix: start over from it. */
const RESET_AFTER_MS = 15_000;

/** One axis of a constant-velocity filter: position and speed along it, with their covariance. */
interface Axis {
  p: number;
  v: number;
  pp: number;
  pv: number;
  vv: number;
}

function predict(a: Axis, dt: number, q: number): void {
  a.p += a.v * dt;
  a.pp += dt * (2 * a.pv + dt * a.vv) + (q * dt ** 4) / 4;
  a.pv += dt * a.vv + (q * dt ** 3) / 2;
  a.vv += q * dt ** 2;
}

function correct(a: Axis, z: number, r: number): void {
  const s = a.pp + r;
  const kp = a.pp / s;
  const kv = a.pv / s;
  const innovation = z - a.p;
  a.p += kp * innovation;
  a.v += kv * innovation;
  const { pp, pv } = a;
  a.pp = (1 - kp) * pp;
  a.pv = (1 - kp) * pv;
  a.vv -= kv * pv;
}

/**
 * Smooths GPS fixes the way navigation apps do instead of dropping the "noisy" ones: a constant-velocity Kalman
 * filter in local meters, trusting each fix by its reported accuracy (a 5 m fix pulls hard, a 25 m one barely) and
 * letting the athlete change speed by about `accelStdMs2` per second. Each fix comes back moved to the estimate.
 */
export class PositionKalman {
  private origin: { lat: number; lng: number; cosLat: number } | null = null;
  private x: Axis | null = null;
  private y: Axis | null = null;
  private lastAt = 0;

  constructor(private readonly accelStdMs2: number) {}

  reset(): void {
    this.origin = null;
    this.x = null;
    this.y = null;
    this.lastAt = 0;
  }

  /** Current speed estimate in m/s, or null before the first fix. */
  get speed(): number | null {
    return this.x && this.y ? Math.hypot(this.x.v, this.y.v) : null;
  }

  update(fix: Location): Location {
    const r = Math.max(fix.accuracy, 1) ** 2;
    const dtMs = fix.timestamp - this.lastAt;
    if (!this.origin || !this.x || !this.y || dtMs > RESET_AFTER_MS) {
      this.origin = { lat: fix.latitude, lng: fix.longitude, cosLat: Math.cos(fix.latitude * DEG) };
      const fresh = (): Axis => ({ p: 0, v: 0, pp: r, pv: 0, vv: INITIAL_SPEED_STD_MS ** 2 });
      this.x = fresh();
      this.y = fresh();
      this.lastAt = fix.timestamp;
      return fix;
    }
    const { lat, lng, cosLat } = this.origin;
    const zx = (fix.longitude - lng) * DEG * EARTH_RADIUS_M * cosLat;
    const zy = (fix.latitude - lat) * DEG * EARTH_RADIUS_M;
    if (dtMs > 0) {
      const q = this.accelStdMs2 ** 2;
      predict(this.x, dtMs / 1000, q);
      predict(this.y, dtMs / 1000, q);
      this.lastAt = fix.timestamp;
    }
    correct(this.x, zx, r);
    correct(this.y, zy, r);
    return {
      ...fix,
      latitude: lat + this.y.p / EARTH_RADIUS_M / DEG,
      longitude: lng + this.x.p / (EARTH_RADIUS_M * cosLat) / DEG,
    };
  }
}
