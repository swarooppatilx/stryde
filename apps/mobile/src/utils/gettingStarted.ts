export type ChecklistId = 'activity' | 'goal' | 'follow' | 'photo';

export interface ChecklistItem {
  id: ChecklistId;
  done: boolean;
}

export interface ChecklistInput {
  activityCount: number;
  goalSet: boolean;
  followingCount: number;
  hasPhoto: boolean;
}

/** The first-minute checklist, in the order worth doing, each marked from what is really on the phone. */
export function deriveChecklist(input: ChecklistInput): ChecklistItem[] {
  return [
    { id: 'activity', done: input.activityCount > 0 },
    { id: 'goal', done: input.goalSet },
    { id: 'follow', done: input.followingCount > 0 },
    { id: 'photo', done: input.hasPhoto },
  ];
}

/** The card shows until every row is done or the athlete sends it away. */
export function checklistVisible(items: readonly ChecklistItem[], dismissed: boolean): boolean {
  return !dismissed && items.some((item) => !item.done);
}

/** Home shows one step at a time: the first one still open, so the card stays a single row. */
export function nextChecklistItem(items: readonly ChecklistItem[]): ChecklistItem | null {
  return items.find((item) => !item.done) ?? null;
}
