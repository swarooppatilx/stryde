import { simplifyPolyline } from './polylineSimplify.js';
import { createTtlCache } from './ttlCache.js';

/** What a feed card needs from an activity's off-chain metadata, in the shapes the app already uses. */
export interface ActivitySummary {
  name?: string;
  description?: string;
  /** Photo links as published; at most four, the post limit. */
  photos?: string[];
  /** `lng,lat;lng,lat` route, thinned to `maxPoints`. */
  route?: string;
  /** The territory ring in the same format, thinned. */
  territory?: string;
  /** The author's request to stay out of other people's Home feeds. */
  mutedFromFeeds?: boolean;
  /** Stats other people's apps leave out; known names only. */
  hiddenStats?: string[];
}

export interface ActivitySummaryLoaderOptions {
  /** Fetches and parses the JSON a metadata CID points at. */
  fetchJson: (cid: string) => Promise<unknown>;
  /** Points kept per route: enough for a card-sized map, small enough for a list response. */
  maxPoints?: number;
  /** Fetches in flight at once, so a page of cards cannot open dozens of gateway connections. */
  concurrency?: number;
  onError?: (cid: string, error: unknown) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PHOTOS = 4;
const MAX_TERRITORY_POINTS = 60;
const HIDDEN_STAT_NAMES: ReadonlySet<string> = new Set(['pace', 'start_time']);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

function ringToPolyline(ring: unknown): string {
  if (!Array.isArray(ring)) return '';
  return ring
    .flatMap((p) =>
      Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [`${p[0]},${p[1]}`] : []
    )
    .join(';');
}

/** Picks the fields a card uses, ignoring everything else and anything of the wrong type. */
function summarize(metadata: unknown, maxPoints: number): ActivitySummary | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const photos = Array.isArray(m.photos)
    ? m.photos.filter((p): p is string => typeof p === 'string').slice(0, MAX_PHOTOS)
    : [];
  const route = typeof m.polyline === 'string' ? simplifyPolyline(m.polyline, maxPoints) : '';
  const territory = simplifyPolyline(ringToPolyline(m.territory), MAX_TERRITORY_POINTS);
  const hiddenStats = Array.isArray(m.hiddenStats)
    ? [...new Set(m.hiddenStats)].filter(
        (s): s is string => typeof s === 'string' && HIDDEN_STAT_NAMES.has(s)
      )
    : [];
  const summary: ActivitySummary = {
    ...(text(m.name) && { name: text(m.name) }),
    ...(text(m.description) && { description: text(m.description) }),
    ...(photos.length > 0 && { photos }),
    ...(route && { route }),
    ...(territory && { territory }),
    ...(m.mutedFromFeeds === true && { mutedFromFeeds: true }),
    ...(hiddenStats.length > 0 && { hiddenStats }),
  };
  return Object.keys(summary).length > 0 ? summary : null;
}

/**
 * Turns metadata CIDs into the small summaries a feed card draws from, so the phone makes one request
 * instead of one gateway fetch per card. A CID's content never changes, so an answer (including "nothing
 * usable") is kept for a day; a failed fetch is not, so the next request tries again. The metadata was
 * already trimmed for privacy when it was published.
 */
export function createActivitySummaryLoader({
  fetchJson,
  maxPoints = 120,
  concurrency = 5,
  onError,
}: ActivitySummaryLoaderOptions) {
  const known = createTtlCache<ActivitySummary | null>(DAY_MS, 2000);
  const inFlight = new Map<string, Promise<ActivitySummary | null>>();

  async function fetchSummary(cid: string): Promise<ActivitySummary | null> {
    try {
      const result = summarize(await fetchJson(cid), maxPoints);
      known.set(cid, result);
      return result;
    } catch (error) {
      onError?.(cid, error);
      return null;
    }
  }

  function summary(cid: string): Promise<ActivitySummary | null> {
    const hit = known.get(cid);
    if (hit !== undefined) return Promise.resolve(hit);
    const pending = inFlight.get(cid);
    if (pending) return pending;
    const started = fetchSummary(cid).finally(() => inFlight.delete(cid));
    inFlight.set(cid, started);
    return started;
  }

  /** Summaries for many CIDs, with at most `concurrency` fetches running at a time. */
  async function summaries(cids: readonly string[]): Promise<Map<string, ActivitySummary>> {
    const unique = [...new Set(cids)];
    const found = new Map<string, ActivitySummary>();
    let next = 0;
    async function worker() {
      while (next < unique.length) {
        const cid = unique[next++] as string;
        const result = await summary(cid);
        if (result) found.set(cid, result);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
    return found;
  }

  return { summary, summaries };
}
