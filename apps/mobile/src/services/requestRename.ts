import type { SetUsernameIntent } from '@/services/profileIntents';
import { validateUsername } from '@/utils/username';

export interface RenameDeps {
  /** Updates the name shown in the app. */
  showLocally(username: string): void;
  /** The name from before the oldest rename still waiting to be sent, if one is waiting. */
  unsentPrevious(): string | undefined;
  /** Hands the rename to the outbox. */
  queue(intent: SetUsernameIntent & { previous: string }): Promise<void>;
}

export type RenameResult = { ok: true; username: string } | { ok: false; error: string };

/**
 * Renames the user, local first: the new name shows at once and is queued. If the chain later
 * refuses it for good (taken), the outbox puts `previous` back.
 */
export async function requestRename(
  deps: RenameDeps,
  current: string,
  requested: string
): Promise<RenameResult> {
  const check = validateUsername(requested);
  if (!check.ok) return { ok: false, error: check.error };
  const next = check.username;
  if (next === current) return { ok: true, username: next };

  const previous = deps.unsentPrevious() ?? current;
  deps.showLocally(next);
  await deps.queue({ username: next, previous });
  return { ok: true, username: next };
}
