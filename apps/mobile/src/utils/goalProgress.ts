interface Totals {
  distance: number;
  duration: number;
  count: number;
}

interface WeeklyGoals {
  distance: number;
  activities: number;
  time: number;
}

export interface GoalLine {
  done: number;
  goal: number;
  /** done / goal, capped at 1 so a bar never overflows. */
  ratio: number;
}

export interface GoalProgress {
  distance: GoalLine;
  activities: GoalLine;
  time: GoalLine;
}

const DAY_MS = 86_400_000;

/** The days in the month of `now`, as weeks. */
export function weeksInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / 7;
}

/** The days in the year of `now`, as weeks. */
export function weeksInYear(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  return Math.round((end - start) / DAY_MS) / 7;
}

const line = (done: number, goal: number): GoalLine => ({
  done,
  goal,
  ratio: goal > 0 ? Math.min(done / goal, 1) : 0,
});

/** How far along a period is against the weekly goals spread over its weeks. */
export function goalProgress(totals: Totals, weekly: WeeklyGoals, weeks: number): GoalProgress {
  return {
    distance: line(totals.distance, weekly.distance * weeks),
    activities: line(totals.count, weekly.activities * weeks),
    time: line(totals.duration, weekly.time * weeks),
  };
}
