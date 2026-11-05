import { ONE_LINE_CONTROL_CHARACTERS } from '@/utils/textRules';

export type ReportTargetKind = 'user' | 'activity' | 'comment';
export type ReportReason = 'spam' | 'abusive' | 'inappropriate' | 'impersonation' | 'other';

/** What is being reported, and whose it is (the wallet that published it). */
export interface ReportTarget {
  kind: ReportTargetKind;
  id: string;
  ownerId: string;
}

/** The reasons offered, in the order shown, in plain words. */
export const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abusive', label: 'Abusive or harassing' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'other', label: 'Something else' },
];

export const MAX_REPORT_NOTE_LENGTH = 200;

/** Nobody reports themselves or their own content, so the entry point is not offered. */
export function canReport(target: ReportTarget, me: string): boolean {
  return !!target.ownerId && target.ownerId.toLowerCase() !== me.toLowerCase();
}

/** The outbox key for one report: the same target is filed under the same key. */
export function reportKey(target: Pick<ReportTarget, 'kind' | 'id'>): string {
  return `report:${target.kind}:${target.id.toLowerCase()}`;
}

/** Activities and comments the athlete reported, hidden on this device by id (users are muted). */
export interface ReportedHidden {
  activities: string[];
  comments: string[];
}

export const NOTHING_REPORTED: ReportedHidden = { activities: [], comments: [] };

const withId = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

/** The list with this target added; a user is not tracked here (it goes to the mute list). */
export function withReportedHidden(hidden: ReportedHidden, target: ReportTarget): ReportedHidden {
  if (target.kind === 'activity') {
    return { ...hidden, activities: withId(hidden.activities, target.id) };
  }
  if (target.kind === 'comment') return { ...hidden, comments: withId(hidden.comments, target.id) };
  return hidden;
}

/** `items` minus those whose id is in `hidden`. */
export function withoutReportedIds<T>(
  items: T[],
  idOf: (item: T) => string,
  hidden: readonly string[]
): T[] {
  if (hidden.length === 0) return items;
  const ids = new Set(hidden);
  return items.filter((item) => !ids.has(idOf(item)));
}

/** Why the optional note cannot be sent, or null when it is fine (or empty). */
export function reportNoteProblem(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length > MAX_REPORT_NOTE_LENGTH) {
    return `Keep it to ${MAX_REPORT_NOTE_LENGTH} characters`;
  }
  if (ONE_LINE_CONTROL_CHARACTERS.test(trimmed)) return 'Use plain text only';
  return null;
}
