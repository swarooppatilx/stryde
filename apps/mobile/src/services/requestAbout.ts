import { services } from '@repo/shared';
import type { SetAboutIntent } from '@/services/profileIntents';
import { ONE_LINE_CONTROL_CHARACTERS } from '@/utils/textRules';

export interface AboutText {
  bio: string;
  location: string;
}

export interface AboutDeps {
  /** Updates the text shown in the app. */
  showLocally(about: AboutText): void;
  /** The text from before the oldest change still waiting to be sent, if one is waiting. */
  unsentPrevious(): AboutText | undefined;
  /** Hands the change to the outbox. */
  queue(intent: SetAboutIntent & { previous: AboutText }): Promise<void>;
}

export type AboutResult = { ok: true } | { ok: false; error: string };

function check(label: string, text: string, max: number): string | null {
  if (text.length > max) return `${label} can be at most ${max} characters`;
  if (ONE_LINE_CONTROL_CHARACTERS.test(text)) {
    return `${label} cannot contain line breaks or control characters`;
  }
  return null;
}

/**
 * Changes the bio and location, local first: the new text shows at once and is queued. If the server
 * later refuses it for good, the outbox puts `previous` back.
 */
export async function requestAbout(
  deps: AboutDeps,
  current: AboutText,
  requested: AboutText
): Promise<AboutResult> {
  const next = { bio: requested.bio.trim(), location: requested.location.trim() };
  const error =
    check('Bio', next.bio, services.profileAbout.MAX_BIO_LENGTH) ??
    check('Location', next.location, services.profileAbout.MAX_LOCATION_LENGTH);
  if (error) return { ok: false, error };
  if (next.bio === current.bio && next.location === current.location) return { ok: true };

  const previous = deps.unsentPrevious() ?? current;
  deps.showLocally(next);
  await deps.queue({ ...next, previous });
  return { ok: true };
}
