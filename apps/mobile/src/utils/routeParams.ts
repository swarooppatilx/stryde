import { logger } from './logger';

/** A JSON value passed through a route param; a damaged one gets `fallback` rather than crashing the screen. */
export function parseJsonParam<T>(raw: string | undefined, label: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`[route] Failed to parse the ${label} param:`, error);
    return fallback;
  }
}
