/** A given thumb opens the kudos list and takes them back only on a long press, so a stray tap cannot undo them. */
export function kudosLabel(kudosFailed: boolean, hasKudoed: boolean): string {
  if (kudosFailed) return 'Kudos could not be saved, tap to change';
  return hasKudoed ? 'See who gave kudos. Hold to remove yours' : 'Give kudos';
}

/** What a tap on the thumb does: a failed save is retried, a given one opens the list, otherwise give kudos. */
export function kudosTapAction(kudosFailed: boolean, hasKudoed: boolean): 'toggle' | 'list' {
  return hasKudoed && !kudosFailed ? 'list' : 'toggle';
}
