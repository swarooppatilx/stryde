const BASE_MESSAGE =
  'This removes your activities, gear, saved routes and settings from this phone, drops anything still waiting to be sent, and logs you out. Anything already saved to the public record cannot be erased.';

/** Says exactly what would be lost; the sentence is left out when nothing is waiting. */
export function deleteDataMessage(unsentChanges: number, unsavedActivities: number): string {
  const parts: string[] = [];
  if (unsentChanges > 0) {
    // The verb agrees with the count, so the noun and the verb are chosen together.
    parts.push(
      unsentChanges === 1
        ? "1 change hasn't been sent yet"
        : `${unsentChanges} changes haven't been sent yet`
    );
  }
  if (unsavedActivities > 0) {
    parts.push(
      unsavedActivities === 1
        ? "1 activity isn't saved to the chain"
        : `${unsavedActivities} activities aren't saved to the chain`
    );
  }
  if (parts.length === 0) return BASE_MESSAGE;
  return `${parts.join(' and ')}. Deleting removes them for good.\n\n${BASE_MESSAGE}`;
}
