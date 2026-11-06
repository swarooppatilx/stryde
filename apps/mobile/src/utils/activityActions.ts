export type OverflowActionKey = 'flyover' | 'copy' | 'download' | 'gpx' | 'delete';

/** What the activity's "more" menu offers, in order; delete is always last so it is never the easy tap. */
export function overflowActionKeys({
  hasRoute,
  isOwner,
}: {
  hasRoute: boolean;
  isOwner: boolean;
}): OverflowActionKey[] {
  // The flyover, image and GPX are all of the route; an activity without one has nothing to copy or export.
  const keys: OverflowActionKey[] = hasRoute ? ['flyover', 'copy', 'download', 'gpx'] : [];
  if (isOwner) keys.push('delete');
  return keys;
}
