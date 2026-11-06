import type { ActivityPrivacy, HiddenStat } from '@/types';
import type { ManualEntryResult } from '@/utils/manualActivity';

interface CanSave {
  isSaving: boolean;
  fromRecording: boolean;
  manual: ManualEntryResult;
  /** A typed-in start time that has not happened yet. */
  startInFuture: boolean;
}

/** A recording can always be saved; a typed-in activity needs numbers that add up and a start in the past. */
export function canSaveActivity({ isSaving, fromRecording, manual, startInFuture }: CanSave) {
  return !isSaving && (fromRecording || (manual.ok && !startInFuture));
}

/**
 * The gear that is selected: the athlete's pick (a pair, or null for none) once they made one,
 * else the first pair of shoes or bike for the sport.
 */
export function defaultGearId(
  picked: string | null | undefined,
  options: readonly { id: string }[]
): string | null {
  return picked === undefined ? (options[0]?.id ?? null) : picked;
}

/** Switching to Only Me hides the activity from everyone, so it is confirmed first. */
export function privacyChangeNeedsConfirm(current: ActivityPrivacy, next: ActivityPrivacy) {
  return next === 'only_me' && current !== 'only_me';
}

/** Only a recorded route has a map to hide, and Only Me already hides everything. */
export function showHideRoute(fromRecording: boolean, privacy: ActivityPrivacy) {
  return fromRecording && privacy !== 'only_me';
}

/** Muting and hiding details only matter for an activity others can see. */
export function showVisibilityControls(privacy: ActivityPrivacy) {
  return privacy !== 'only_me';
}

/** The row's value: 'None', or how many figures are hidden. */
export function hiddenDetailsSummary(hidden: readonly HiddenStat[]): string {
  return hidden.length === 0 ? 'None' : String(hidden.length);
}

export function toggleHiddenStat(
  hidden: readonly HiddenStat[],
  stat: HiddenStat,
  on: boolean
): HiddenStat[] {
  const rest = hidden.filter((s) => s !== stat);
  return on ? [...rest, stat] : rest;
}

/** What gets saved for the two visibility choices; unset when off, and for Only Me, which nobody else sees. */
export function visibilityFlags(input: {
  privacy: ActivityPrivacy;
  muted: boolean;
  hiddenStats: readonly HiddenStat[];
}): { mutedFromFeeds: true | undefined; hiddenStats: HiddenStat[] | undefined } {
  const shown = showVisibilityControls(input.privacy);
  return {
    mutedFromFeeds: shown && input.muted ? true : undefined,
    hiddenStats: shown && input.hiddenStats.length > 0 ? [...input.hiddenStats] : undefined,
  };
}

/** The confirmation shown before a form is thrown away, by the close button and the Discard button alike. */
export function discardPrompt(recorded: boolean) {
  return {
    title: recorded ? 'Discard this recording?' : 'Discard Activity?',
    message: recorded ? "This recording can't be recovered." : 'Your changes will be lost.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep Editing',
  };
}
