import type { Ring } from '../types';
import { indexCall } from './indexApi';
import type { ActivityMetadata } from './ipfs';

interface IndexSummary {
  name?: string;
  description?: string;
  photos?: string[];
  route?: string;
  territory?: string;
  mutedFromFeeds?: boolean;
  hiddenStats?: string[];
}

interface IndexActivities {
  activities?: unknown;
}

const SUMMARY_LIMIT = 200;

function parseRing(encoded: string | undefined): Ring | null {
  if (!encoded) return null;
  const ring: Ring = [];
  for (const pair of encoded.split(';')) {
    const [lng, lat] = pair.split(',').map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) ring.push([lng as number, lat as number]);
  }
  return ring.length >= 3 ? ring : null;
}

/**
 * What the Arkiv index already read from each activity's metadata, keyed by CID, in the shape the
 * IPFS fetch would have produced. One request replaces a gateway fetch per feed card. Null when the
 * index cannot answer, so the caller fetches from IPFS as it always did.
 */
export async function getActivitySummaries(): Promise<Map<string, ActivityMetadata> | null> {
  const body = await indexCall<IndexActivities>(`activities?withRoute=1&limit=${SUMMARY_LIMIT}`);
  if (!body || !Array.isArray(body.activities)) return null;

  const byCid = new Map<string, ActivityMetadata>();
  for (const row of body.activities as Array<{
    metadataCid?: string | null;
    summary?: IndexSummary;
  }>) {
    if (!row.metadataCid || !row.summary) continue;
    const { name, description, photos, route, territory, mutedFromFeeds, hiddenStats } =
      row.summary;
    byCid.set(row.metadataCid, {
      ...(name && { name }),
      ...(description && { description }),
      ...(photos && { photos }),
      ...(route && { polyline: route }),
      ...(territory && { territory: parseRing(territory) }),
      ...(mutedFromFeeds === true && { mutedFromFeeds }),
      ...(hiddenStats?.length ? { hiddenStats } : {}),
    });
  }
  return byCid;
}
