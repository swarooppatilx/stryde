import type { services } from '@repo/shared';

type Counts = services.account.AccountDeleteCounts;

export const DELETE_CONFIRM_WORD = 'DELETE';

/** The typed confirmation: the word, in any case, with stray spaces ignored. */
export function isDeleteConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === DELETE_CONFIRM_WORD;
}

export const deletionCopy = {
  intro:
    'This removes the records Stryde stored for your account, wipes this phone and logs you out. It cannot be undone.',
  permanent:
    'Activities already saved to the public record and photos shared publicly cannot be erased by anyone, including us.',
  exportFirst: 'Want a copy first? Export your data before you delete.',
  queued:
    'You are offline or the server could not be reached. Your request is saved and will be sent when you are back online. Nothing has been removed yet. Stay signed in until it has been sent, because the app needs your account to send it.',
  refused:
    'The server refused the request. Nothing was removed. Try again later or contact support.',
} as const;

const LABELS: ReadonlyArray<readonly [keyof Counts, string, string]> = [
  ['follows', 'follow', 'follows'],
  ['posts', 'post', 'posts'],
  ['about', 'profile text', 'profile texts'],
  ['commentLikes', 'comment like', 'comment likes'],
  ['reports', 'report', 'reports'],
  ['pushTokens', 'notification device', 'notification devices'],
  ['beacons', 'live position', 'live positions'],
];

/** What the server removed, in plain words; only the kinds that had something. */
export function removedSummary(counts: Counts): string {
  const parts = LABELS.filter(([kind]) => counts[kind] > 0).map(
    ([kind, one, many]) => `${counts[kind]} ${counts[kind] === 1 ? one : many}`
  );
  if (parts.length === 0) return 'The server held no records for your account.';
  const last = parts.pop();
  const list = parts.length === 0 ? last : `${parts.join(', ')} and ${last}`;
  return `${list} removed from the server.`;
}
