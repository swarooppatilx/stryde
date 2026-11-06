/** The training facts the phone computes and the plan is held to; every number is range-checked here. */

export const FACT_FEELS = ['great', 'good', 'ok', 'bad', 'terrible'] as const;
export const GOAL_METRICS = ['distance', 'time', 'elevation', 'activities'] as const;
export type FactFeel = (typeof FACT_FEELS)[number];
export type GoalMetric = (typeof GOAL_METRICS)[number];

export interface FactVolume {
  km: number;
  minutes: number;
  runs: number;
}

export interface FactGoal {
  title: string;
  metric: GoalMetric;
  done: number;
  target: number;
  reached: boolean;
  daysLeft: number;
}

export interface CoachFacts {
  week: FactVolume;
  lastWeek: FactVolume;
  longestKm14: number | null;
  daysSinceHard: number | null;
  hardDays7: number;
  lastFeel: { feel: FactFeel; daysAgo: number } | null;
  goals: FactGoal[];
  nextRun: string | null;
}

const MAX_GOALS = 5;

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One tidy line of text: control characters become spaces, so a title can't break the prompt. */
function line(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return Array.from(v, (ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function volume(v: unknown): FactVolume | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const km = num(o.km, 0, 1000);
  const minutes = num(o.minutes, 0, 60_000);
  const runs = num(o.runs, 0, 200);
  if (km === null || minutes === null || runs === null) return null;
  return { km: round1(km), minutes: Math.round(minutes), runs: Math.round(runs) };
}

function goal(v: unknown): FactGoal | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = line(o.title, 60);
  const metric = GOAL_METRICS.find((m) => m === o.metric);
  const done = num(o.done, 0, 10_000_000);
  const target = num(o.target, 0, 10_000_000);
  const daysLeft = num(o.daysLeft, 0, 366);
  if (!title || !metric || done === null || target === null || daysLeft === null) return null;
  return {
    title,
    metric,
    done: round1(done),
    target: round1(target),
    reached: o.reached === true,
    daysLeft: Math.round(daysLeft),
  };
}

/** The facts from a request body, or null when the weekly figures are missing or implausible. */
export function parseFacts(raw: unknown): CoachFacts | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const week = volume(o.week);
  const lastWeek = volume(o.lastWeek);
  if (!week || !lastWeek) return null;

  const longest = num(o.longestKm14, 0, 300);
  const since = num(o.daysSinceHard, 0, 3650);
  const hardDays = num(o.hardDays7, 0, 7);
  const felt = (o.lastFeel ?? {}) as Record<string, unknown>;
  const feel = FACT_FEELS.find((f) => f === felt.feel);
  const feelAge = num(felt.daysAgo, 0, 365);
  const nextRun = line(o.nextRun, 280);

  return {
    week,
    lastWeek,
    longestKm14: longest === null ? null : round1(longest),
    daysSinceHard: since === null ? null : Math.round(since),
    hardDays7: hardDays === null ? 0 : Math.round(hardDays),
    lastFeel: feel && feelAge !== null ? { feel, daysAgo: Math.round(feelAge) } : null,
    goals: (Array.isArray(o.goals) ? o.goals : [])
      .slice(0, MAX_GOALS)
      .map(goal)
      .filter((g) => g !== null),
    nextRun: nextRun || null,
  };
}

const UNIT: Record<GoalMetric, string> = {
  distance: 'km',
  time: 'min',
  elevation: 'm',
  activities: 'activities',
};

function ago(days: number): string {
  if (days === 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** The facts as prompt lines the model can quote. */
export function describeFacts(f: CoachFacts): string {
  const lines = [
    `This week so far: ${f.week.km} km in ${f.week.runs} outing(s), ${f.week.minutes} min.`,
    `Last week: ${f.lastWeek.km} km in ${f.lastWeek.runs} outing(s), ${f.lastWeek.minutes} min.`,
  ];
  if (f.longestKm14 !== null)
    lines.push(`Longest outing in the last 14 days: ${f.longestKm14} km.`);
  lines.push(
    f.daysSinceHard === null
      ? 'No hard session on record.'
      : `Last hard session: ${ago(f.daysSinceHard)}; hard days in the last 7: ${f.hardDays7}.`
  );
  if (f.lastFeel) lines.push(`Last marked feel: ${f.lastFeel.feel} (${ago(f.lastFeel.daysAgo)}).`);
  for (const g of f.goals) {
    lines.push(
      `Goal "${g.title}": ${g.done} of ${g.target} ${UNIT[g.metric]}${g.reached ? ' (reached)' : `, ${g.daysLeft} day(s) left`}.`
    );
  }
  if (f.nextRun) lines.push(`Their last post-run review suggested: ${f.nextRun}`);
  return lines.join('\n');
}
