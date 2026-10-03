import type { Clock } from './ports';

export const systemClock: Clock = { now: () => Date.now() };
