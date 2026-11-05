import type { Activity } from '@/types';
import { parsePolyline, toPolyline } from '@/utils/format';
import { logger } from '@/utils/logger';
import { publicRoute } from '@/utils/routePrivacy';
import type { ActivityChain, PhotoUploader } from './postRun';

const isPublished = (uri: string) => uri.startsWith('http');
const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((uri, i) => uri === b[i]);

async function uploadLocal(
  uris: readonly string[],
  uploader: Pick<PhotoUploader, 'upload'>
): Promise<string[]> {
  const out: string[] = [];
  for (const uri of uris) {
    if (isPublished(uri)) {
      out.push(uri);
      continue;
    }
    try {
      out.push(await uploader.upload(`activity-${Date.now()}`, uri));
    } catch (error) {
      logger.warn('[EditActivity] Photo upload failed, keeping it on this device', error);
      out.push(uri);
    }
  }
  return out;
}

export interface ActivityEdit {
  /** Ignored when blank: an activity always has a title. */
  name?: string;
  /** Blank clears it. */
  description?: string;
  /** The full photo list, in order: links already published and paths still on this device. */
  photos?: string[];
}

export interface EditDeps {
  store: { updateActivity(id: string, patch: Partial<Activity>): void };
  /** Null when there is no wallet yet: the edit then stays on this device. */
  chain: Pick<ActivityChain, 'setMetadata'> | null;
  /** Needed to publish photos added after the save; without it they stay on this device. */
  uploader?: Pick<PhotoUploader, 'upload'> | null;
}

export type EditResult =
  | { published: true }
  | { published: false; reason: 'unchanged' | 'local-only' }
  | { published: false; reason: 'failed'; error?: unknown };

/**
 * Edits a saved activity. It changes on this device at once; if it is onchain it is also republished,
 * because other people read its title and description from the IPFS metadata. The route is republished
 * exactly as it was first published (ends hidden or not), so an edit can never reveal what was hidden.
 */
export async function editActivity(
  { store, chain, uploader }: EditDeps,
  activity: Activity,
  edit: ActivityEdit
): Promise<EditResult> {
  const patch: Partial<Activity> = {};
  const name = edit.name?.trim();
  if (name && name !== activity.name) patch.name = name;
  if (edit.description !== undefined) {
    const description = edit.description.trim() || undefined;
    if (description !== activity.description) patch.description = description;
  }
  if (edit.photos && !sameList(edit.photos, activity.images ?? [])) {
    patch.images = edit.photos.length > 0 ? [...edit.photos] : undefined;
  }
  if (Object.keys(patch).length === 0) return { published: false, reason: 'unchanged' };

  store.updateActivity(activity.id, patch);

  // An Only Me activity's details never leave this phone, edited or not (see `postRun`).
  if (!chain || !activity.onchainActivityId || activity.privacy === 'only_me') {
    return { published: false, reason: 'local-only' };
  }

  let merged = { ...activity, ...patch };
  if (patch.images && uploader) {
    // Photos added after the save get their links now; one that won't upload stays here for later.
    const images = await uploadLocal(patch.images, uploader);
    if (!sameList(images, patch.images)) {
      store.updateActivity(activity.id, { images });
      merged = { ...merged, images };
    }
  }
  const shared = publicRoute(activity.hideRoute ? [] : parsePolyline(activity.polyline), {
    hideEnds: activity.hideRouteEnds ?? false,
    zones: activity.privacyZones ?? [],
    seed: activity.id,
  });
  const route = shared.route;
  const photos = (merged.images ?? []).filter(isPublished);

  try {
    const result = await chain.setMetadata(BigInt(activity.onchainActivityId), {
      name: merged.name,
      description: merged.description,
      photos: photos.length > 0 ? photos : undefined,
      polyline: route.length > 0 ? toPolyline(route) : undefined,
      territory:
        shared.cutByZone || activity.hideRoute ? undefined : (activity.territory ?? undefined),
      coordinates: route.length > 0 ? route : undefined,
    });
    if (!result?.confirmed) return { published: false, reason: 'failed' };
    store.updateActivity(activity.id, { metadataCid: result.cid });
    return { published: true };
  } catch (error) {
    logger.warn('[EditActivity] Could not republish the metadata', error);
    return { published: false, reason: 'failed', error };
  }
}
