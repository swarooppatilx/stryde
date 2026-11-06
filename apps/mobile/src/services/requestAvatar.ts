import type { PhotoLibrary } from '@/platform/ports';
import type { SetAvatarIntent } from '@/services/profileIntents';
import { logger } from '@/utils/logger';

export interface AvatarDeps {
  pick: PhotoLibrary['pick'];
  /** Shows the picked photo from this device straight away. */
  showLocally(uri: string): void;
  /** Drops the cid of the old published photo, since it no longer matches what is shown. */
  forgetPublished(): void;
  /** Hands the upload and the onchain record to the outbox. */
  queue(intent: SetAvatarIntent): Promise<void>;
}

export type AvatarRequest = 'queued' | 'denied' | 'cancelled' | 'failed';

/** Picks a new profile photo, local first: it shows at once and the outbox uploads and records it. */
export async function requestAvatar(deps: AvatarDeps): Promise<AvatarRequest> {
  let uri: string | undefined;
  try {
    const result = await deps.pick({ aspect: [1, 1] });
    if (result.status === 'denied') return 'denied';
    uri = result.uris[0];
  } catch (error) {
    logger.warn('[Avatar] Could not pick a photo', error);
    return 'failed';
  }
  if (!uri) return 'cancelled';

  deps.forgetPublished();
  deps.showLocally(uri);
  await deps.queue({ uri });
  return 'queued';
}
