/** Prompts and parsing for the Stryde Coach, which runs its inference on 0G. */

export type Sport = 'run' | 'walk' | 'ride' | 'hike' | string;

export interface RunSummary {
  activityType: Sport;
  distanceM: number;
  durationS: number;
  elevationGainM?: number;
  /** ISO date the activity started. */
  startedAt: string;
  name?: string;
  place?: string;
  /** The athlete's own words from a voice debrief, already summarised. */
  debrief?: string;
  effort?: number;
  /** How hard it was, as the phone read it from the debrief, marks and heart rate. */
  signal?: RunSignal;
  feel?: RunFeel;
  avgHr?: number;
}

export const RUN_SIGNALS = ['easy', 'moderate', 'hard'] as const;
export const RUN_FEELS = ['great', 'good', 'ok', 'bad', 'terrible'] as const;
export type RunSignal = (typeof RUN_SIGNALS)[number];
export type RunFeel = (typeof RUN_FEELS)[number];

export interface WorkoutStep {
  label: string;
  detail: string;
}

export const PLAN_TYPES = [
  'rest',
  'recovery',
  'easy',
  'tempo',
  'intervals',
  'long',
  'cross',
] as const;
export const PLAN_EFFORTS = ['rest', 'easy', 'moderate', 'hard'] as const;

export type PlanType = (typeof PLAN_TYPES)[number];
export type PlanEffort = (typeof PLAN_EFFORTS)[number];

export interface DailyPlan {
  title: string;
  /** What kind of session it is; checked against the athlete's load before it is shown. */
  type: PlanType;
  /** Target distance, or null for rest and time-based sessions. */
  distanceKm: number | null;
  durationMin: number | null;
  effort: PlanEffort;
  summary: string;
  steps: WorkoutStep[];
  why: string;
}

export interface Debrief {
  summary: string;
  /** 1 (easy) to 10 (all-out), as the athlete described it. */
  effort: number | null;
  feel: 'great' | 'good' | 'ok' | 'tough' | 'bad' | null;
  tags: string[];
}

const FEELS = ['great', 'good', 'ok', 'tough', 'bad'] as const;

function km(m: number): string {
  return (m / 1000).toFixed(2);
}

function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(sec).padStart(2, '0')}s`;
}

function pace(distanceM: number, durationS: number): string {
  if (distanceM < 50) return 'n/a';
  const perKm = durationS / (distanceM / 1000);
  return `${Math.floor(perKm / 60)}:${String(Math.round(perKm % 60)).padStart(2, '0')}/km`;
}

export function describeRun(run: RunSummary): string {
  const parts = [
    run.startedAt.slice(0, 10),
    run.activityType,
    `${km(run.distanceM)} km`,
    clock(run.durationS),
    pace(run.distanceM, run.durationS),
  ];
  if (run.elevationGainM) parts.push(`+${Math.round(run.elevationGainM)} m`);
  if (run.effort) parts.push(`effort ${run.effort}/10`);
  if (run.signal) parts.push(`${run.signal} session`);
  if (run.feel) parts.push(`felt ${run.feel}`);
  if (run.avgHr) parts.push(`avg HR ${run.avgHr}`);
  if (run.debrief) parts.push(`athlete said: "${run.debrief.slice(0, 200)}"`);
  return parts.join(' · ');
}

/** First JSON object in a model reply, tolerating code fences and chatter around it. */
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function planMessages(history: RunSummary[], today: string, goal?: string) {
  const log = history.length
    ? history.map((r) => `- ${describeRun(r)}`).join('\n')
    : '- No activities recorded yet.';
  return [
    {
      role: 'system' as const,
      content:
        "You are Stryde Coach, a running and walking coach. Plan exactly one session for today from the athlete's recent log. " +
        'Respect recovery: after a hard or long day suggest easy or rest. Keep it achievable for the volume you see. ' +
        'Reply with JSON only: {"title": string (max 6 words), ' +
        `"type": one of ${PLAN_TYPES.join('|')}, ` +
        '"distanceKm": number or null, "durationMin": number or null, ' +
        `"effort": one of ${PLAN_EFFORTS.join('|')}, ` +
        '"summary": string (one sentence), ' +
        '"steps": [{"label": string, "detail": string}] (2-5 steps with distances or minutes and target pace or effort), ' +
        '"why": string (one sentence that cites their recent log)}.',
    },
    {
      role: 'user' as const,
      content: `Today is ${today}.${goal ? ` Goal: ${goal}.` : ''}\nRecent log (newest first):\n${log}`,
    },
  ];
}

/** A plan figure: absent or null is fine, a number must be positive and believable. `false` means reject. */
function planAmount(value: unknown, max: number, decimals: number): number | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    return false;
  }
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function parsePlan(text: string): DailyPlan | null {
  const json = extractJson(text);
  if (!json) return null;
  const steps = Array.isArray(json.steps)
    ? json.steps
        .map((s) => ({
          label: str((s as WorkoutStep)?.label, 60),
          detail: str((s as WorkoutStep)?.detail, 200),
        }))
        .filter((s) => s.label)
        .slice(0, 6)
    : [];
  const title = str(json.title, 60);
  const type = PLAN_TYPES.find((t) => t === json.type);
  const effort = PLAN_EFFORTS.find((e) => e === json.effort);
  const distanceKm = planAmount(json.distanceKm, 60, 1);
  const durationMin = planAmount(json.durationMin, 300, 0);
  if (!title || steps.length === 0 || !type || !effort) return null;
  if (distanceKm === false || durationMin === false) return null;
  const resting = type === 'rest';
  return {
    title,
    type,
    distanceKm: resting ? null : distanceKm,
    durationMin: resting ? null : durationMin,
    effort: resting ? 'rest' : effort,
    summary: str(json.summary, 240),
    steps,
    why: str(json.why, 240),
  };
}

export function debriefMessages(transcript: string, run: RunSummary) {
  return [
    {
      role: 'system' as const,
      content:
        "You turn an athlete's spoken post-run debrief into a training note. " +
        'Reply with JSON only: {"summary": string (one or two sentences in first person, their words tidied), ' +
        '"effort": integer 1-10 or null, "feel": "great"|"good"|"ok"|"tough"|"bad"|null, ' +
        '"tags": string[] (up to 4 short lowercase tags such as "hills", "sore calves", "negative split")}.',
    },
    {
      role: 'user' as const,
      content: `Activity: ${describeRun(run)}\nDebrief transcript: "${transcript.slice(0, 2000)}"`,
    },
  ];
}

export function parseDebrief(text: string, transcript: string): Debrief {
  const json = extractJson(text) ?? {};
  const effort = Number(json.effort);
  const feel = FEELS.find((f) => f === json.feel) ?? null;
  return {
    summary: str(json.summary, 400) || transcript.slice(0, 400),
    effort: Number.isInteger(effort) && effort >= 1 && effort <= 10 ? effort : null,
    feel,
    tags: Array.isArray(json.tags)
      ? json.tags
          .map((t) => str(t, 24).toLowerCase())
          .filter(Boolean)
          .slice(0, 4)
      : [],
  };
}

/** What the watch, phone and splits measured; every field is optional because older runs lack most. */
export interface RunVitals {
  /** Seconds per km for each split, with the net metres climbed when known. */
  splits?: { index: number; paceS: number; elevationM?: number }[];
  heartRate?: { avg: number; max: number; driftBpm?: number };
  zones?: { label: string; minutes: number }[];
  maxHr?: number;
  restingHr?: number;
  cadenceSpm?: number;
  powerW?: number;
  calories?: number;
  elevationLossM?: number;
  /** Time stopped during the recording: elapsed minus moving. */
  stoppedS?: number;
  bestEfforts?: { distanceM: number; timeS: number }[];
  feel?: string;
  effort?: string;
}

export interface ReviewVital {
  label: string;
  reading: string;
  note: string;
}

export interface ReviewFocus {
  focus: string;
  tip: string;
}

export interface Review {
  headline: string;
  summary: string;
  wentWell: string[];
  vitals: ReviewVital[];
  improve: ReviewFocus[];
  nextRun: string;
}

const MAX_SPLITS = 60;

function num(v: unknown, min: number, max: number): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Keeps only believable readings, so a broken sensor or a crafted body can't steer the prompt. */
export function toVitals(value: unknown): RunVitals {
  if (!value || typeof value !== 'object') return {};
  const v = value as Record<string, unknown>;
  const splits = (Array.isArray(v.splits) ? v.splits : [])
    .slice(0, MAX_SPLITS)
    .map((s) => {
      const split = (s ?? {}) as Record<string, unknown>;
      const index = num(split.index, 1, 1000);
      const paceS = num(split.paceS, 60, 3600);
      if (index === undefined || paceS === undefined) return null;
      const elevationM = num(split.elevationM, -2000, 2000);
      return {
        index,
        paceS: Math.round(paceS),
        ...(elevationM === undefined ? {} : { elevationM: Math.round(elevationM) }),
      };
    })
    .filter((s) => s !== null);
  const hr = (v.heartRate ?? {}) as Record<string, unknown>;
  const avg = num(hr.avg, 30, 250);
  const max = num(hr.max, 30, 250);
  const drift = num(hr.driftBpm, -80, 80);
  const zones = (Array.isArray(v.zones) ? v.zones : [])
    .slice(0, 5)
    .map((z) => {
      const zone = (z ?? {}) as Record<string, unknown>;
      const minutes = num(zone.minutes, 0, 1440);
      const label = str(zone.label, 24);
      return label && minutes !== undefined
        ? { label, minutes: Math.round(minutes * 10) / 10 }
        : null;
    })
    .filter((z) => z !== null);
  const bestEfforts = (Array.isArray(v.bestEfforts) ? v.bestEfforts : [])
    .slice(0, 5)
    .map((e) => {
      const effort = (e ?? {}) as Record<string, unknown>;
      const distanceM = num(effort.distanceM, 100, 100_000);
      const timeS = num(effort.timeS, 10, 86_400);
      return distanceM && timeS ? { distanceM, timeS: Math.round(timeS) } : null;
    })
    .filter((e) => e !== null);
  const vitals: RunVitals = {
    ...(splits.length ? { splits } : {}),
    ...(avg && max
      ? {
          heartRate: {
            avg: Math.round(avg),
            max: Math.round(max),
            ...(drift === undefined ? {} : { driftBpm: Math.round(drift) }),
          },
        }
      : {}),
    ...(zones.length ? { zones } : {}),
    ...(bestEfforts.length ? { bestEfforts } : {}),
  };
  const scalars = {
    maxHr: num(v.maxHr, 100, 230),
    restingHr: num(v.restingHr, 25, 120),
    cadenceSpm: num(v.cadenceSpm, 20, 260),
    powerW: num(v.powerW, 10, 2000),
    calories: num(v.calories, 1, 20_000),
    elevationLossM: num(v.elevationLossM, 1, 10_000),
    stoppedS: num(v.stoppedS, 1, 86_400),
  };
  for (const [key, val] of Object.entries(scalars)) {
    if (val !== undefined) vitals[key as keyof typeof scalars] = Math.round(val);
  }
  if (str(v.feel, 16)) vitals.feel = str(v.feel, 16);
  if (str(v.effort, 16)) vitals.effort = str(v.effort, 16);
  return vitals;
}

function paceText(paceS: number): string {
  return `${Math.floor(paceS / 60)}:${String(Math.round(paceS % 60)).padStart(2, '0')}/km`;
}

export function describeVitals(v: RunVitals): string {
  const lines: string[] = [];
  if (v.splits?.length) {
    const list = v.splits
      .map((s) => {
        const climb = s.elevationM ? ` (${s.elevationM > 0 ? '+' : ''}${s.elevationM} m)` : '';
        return `${s.index}: ${paceText(s.paceS)}${climb}`;
      })
      .join(', ');
    lines.push(`Splits: ${list}`);
  }
  if (v.heartRate) {
    const drift =
      v.heartRate.driftBpm === undefined
        ? ''
        : `, second half ${v.heartRate.driftBpm >= 0 ? '+' : ''}${v.heartRate.driftBpm} bpm vs first half`;
    lines.push(`Heart rate: avg ${v.heartRate.avg} bpm, max ${v.heartRate.max} bpm${drift}`);
  }
  if (v.maxHr || v.restingHr) {
    lines.push(
      `Athlete heart rate: ${v.maxHr ? `max ${v.maxHr}` : ''}${v.maxHr && v.restingHr ? ', ' : ''}${v.restingHr ? `resting ${v.restingHr}` : ''} bpm`
    );
  }
  if (v.zones?.length) {
    lines.push(`Time in zones: ${v.zones.map((z) => `${z.label} ${z.minutes} min`).join(', ')}`);
  }
  if (v.cadenceSpm) lines.push(`Average cadence: ${v.cadenceSpm} steps/min`);
  if (v.powerW) lines.push(`Average power: ${v.powerW} W`);
  if (v.calories) lines.push(`Calories: ${v.calories} kcal`);
  if (v.elevationLossM) lines.push(`Descent: ${v.elevationLossM} m`);
  if (v.stoppedS) lines.push(`Stopped for: ${clock(v.stoppedS)}`);
  if (v.bestEfforts?.length) {
    lines.push(
      `Best efforts: ${v.bestEfforts.map((e) => `${km(e.distanceM)} km in ${clock(e.timeS)}`).join(', ')}`
    );
  }
  if (v.feel) lines.push(`Athlete marked the feel as: ${v.feel}`);
  if (v.effort) lines.push(`Athlete marked the effort as: ${v.effort}`);
  return lines.length ? lines.join('\n') : 'No sensor data beyond distance and time.';
}

export function reviewMessages(run: RunSummary, vitals: RunVitals, history: RunSummary[]) {
  const log = history.length
    ? history.map((r) => `- ${describeRun(r)}`).join('\n')
    : '- None in the last two weeks.';
  return [
    {
      role: 'system' as const,
      content:
        'You are Stryde Coach, an experienced running and endurance coach reviewing one activity the athlete just finished. ' +
        'Be specific: cite their actual numbers (paces, bpm, cadence, splits). Be encouraging but honest. ' +
        'Read pacing (even, positive or negative split, fade), heart-rate drift and zones, cadence (runners: about 165-185 steps/min is efficient; slower often means overstriding), ' +
        'climbing and stops. Compare with their recent log when it helps. Only comment on data you were given; never invent readings. ' +
        'You are not a doctor: if a reading looks implausible, say the sensor may be off rather than diagnosing. ' +
        'Reply with JSON only: {"headline": string (max 8 words), "summary": string (two sentences on what they did), ' +
        '"wentWell": string[] (1-3 short points), ' +
        '"vitals": [{"label": string, "reading": string, "note": string}] (2-5 items such as Pace, Heart rate, Cadence, Splits, Climbing; reading is the number, note is what it means for them), ' +
        '"improve": [{"focus": string (max 5 words), "tip": string (one concrete drill or change)}] (2-3 items), ' +
        '"nextRun": string (one sentence: what their next session should be and why)}.',
    },
    {
      role: 'user' as const,
      content: `Activity: ${describeRun(run)}\n${describeVitals(vitals)}\nRecent log (newest first):\n${log}`,
    },
  ];
}

export function parseReview(text: string): Review | null {
  const json = extractJson(text);
  if (!json) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const wentWell = list(json.wentWell)
    .map((s) => str(s, 200))
    .filter(Boolean)
    .slice(0, 3);
  const vitals = list(json.vitals)
    .map((item) => {
      const v = (item ?? {}) as Record<string, unknown>;
      return { label: str(v.label, 40), reading: str(v.reading, 60), note: str(v.note, 240) };
    })
    .filter((v) => v.label && (v.reading || v.note))
    .slice(0, 6);
  const improve = list(json.improve)
    .map((item) => {
      const v = (item ?? {}) as Record<string, unknown>;
      return { focus: str(v.focus, 60), tip: str(v.tip, 280) };
    })
    .filter((v) => v.focus && v.tip)
    .slice(0, 4);
  const headline = str(json.headline, 80);
  const summary = str(json.summary, 500);
  if (!headline || !summary || improve.length === 0) return null;
  return { headline, summary, wentWell, vitals, improve, nextRun: str(json.nextRun, 280) };
}

const SCENES: Record<string, string> = {
  run: 'a lone runner mid-stride',
  walk: 'a walker striding with purpose',
  hike: 'a hiker on a ridge trail',
  ride: 'a cyclist leaning into a bend',
};

function timeOfDay(iso: string): string {
  const hour = new Date(iso).getHours();
  if (hour < 6) return 'pre-dawn blue light';
  if (hour < 10) return 'golden sunrise light';
  if (hour < 16) return 'bright midday light';
  if (hour < 19) return 'warm late-afternoon light';
  return 'neon-lit night';
}

export interface PosterStyle {
  label: string;
  direction: string;
}

export const POSTER_STYLES: Record<string, PosterStyle> = {
  synthwave: {
    label: 'Synthwave',
    direction:
      '1980s synthwave: neon magenta and cyan, chrome sun on a gridded horizon, VHS glow, airbrushed retro-futurism',
  },
  ukiyoe: {
    label: 'Ukiyo-e',
    direction:
      'Japanese ukiyo-e woodblock print: flat bold colour, Hokusai-style waves and clouds, washi paper grain, indigo and vermilion',
  },
  comic: {
    label: 'Comic',
    direction:
      'comic book splash page: heavy ink lines, halftone dots, speed lines and impact bursts, saturated primaries, heroic low angle',
  },
  travel: {
    label: 'Vintage travel',
    direction:
      '1930s vintage travel poster: art deco geometry, flat lithograph colours, long dramatic shadows, a sun-washed landmark skyline',
  },
  risograph: {
    label: 'Risograph',
    direction:
      'two-colour risograph print: fluorescent pink and teal overlapping inks, misregistration, grainy texture, bold Swiss grid',
  },
  watercolor: {
    label: 'Watercolour',
    direction:
      'loose expressive watercolour and ink: wet bleeds, splatter, soft dawn palette, motion captured in a few confident strokes',
  },
  constructivist: {
    label: 'Bold graphic',
    direction:
      'constructivist propaganda-style graphic: red, black and cream, diagonal compositions, bold geometric shapes, dynamic angles',
  },
  cinematic: {
    label: 'Cinematic',
    direction:
      'cinematic movie-poster photography: dramatic rim light, volumetric haze, shallow depth of field, epic teal-and-orange grade',
  },
};

export const POSTER_STYLE_IDS = Object.keys(POSTER_STYLES);

/** The athlete's pick when it is one we know, else a random style so every poster feels new. */
export function pickPosterStyle(requested: unknown, random = Math.random): string {
  if (typeof requested === 'string' && requested in POSTER_STYLES) return requested;
  return POSTER_STYLE_IDS[Math.floor(random() * POSTER_STYLE_IDS.length)] ?? 'cinematic';
}

export interface PosterDirection {
  title: string;
  prompt: string;
}

export function posterDirectorMessages(run: RunSummary, styleId: string, mood?: string) {
  const style = POSTER_STYLES[styleId] ?? POSTER_STYLES.cinematic;
  return [
    {
      role: 'system' as const,
      content:
        'You are the art director for Stryde, turning one finished workout into a collectible poster. ' +
        "Invent one striking, specific image that tells this workout's story: the time of day, the place, the distance, the effort, how the athlete felt. " +
        'Use metaphor and drama (a runner outpacing a storm, a city waking up, a dragon of a hill), not a stock photo. ' +
        'The athlete is an anonymous figure seen from behind, in silhouette or at a distance; no recognisable faces, no brands, no logos. ' +
        'Compose for a vertical 9:16 poster with room for a big title at the top and a calm lower third. ' +
        'Reply with JSON only: {"title": string (1-3 punchy words naming this workout, no numbers, no emoji), ' +
        '"prompt": string (70-120 words describing subject, setting, composition, light, palette and texture in the requested style; do not mention any text or lettering)}.',
    },
    {
      role: 'user' as const,
      content: [
        `Workout: ${describeRun(run)}`,
        `Time of day: ${timeOfDay(run.startedAt)}`,
        run.place ? `Place: ${run.place}` : '',
        run.name ? `The athlete named it: "${run.name}"` : '',
        mood ? `Mood they asked for: ${mood.slice(0, 80)}` : '',
        `Art style: ${style?.direction}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export function parsePosterDirection(text: string): PosterDirection | null {
  const json = extractJson(text);
  if (!json) return null;
  const title = str(json.title, 32)
    .replace(/["\u201c\u201d]/g, '')
    .trim();
  const prompt = str(json.prompt, 1200);
  if (!title || prompt.length < 40) return null;
  return { title, prompt };
}

/** The art director's scene, finished with the poster's lettering and the rules every image follows. */
export function posterImagePrompt(
  direction: PosterDirection,
  run: RunSummary,
  styleId: string
): string {
  const style = POSTER_STYLES[styleId] ?? POSTER_STYLES.cinematic;
  const distance = `${(run.distanceM / 1000).toFixed(1)} KM`;
  return [
    direction.prompt,
    `Style: ${style?.direction}.`,
    `Typography: the title "${direction.title.toUpperCase()}" in huge bold poster lettering across the top, with "${distance}" smaller beneath it, lettering integrated into the artwork's style.`,
    'Vertical 9:16 poster, highly detailed, award-winning poster design. No other words, no logos, no watermarks, no recognisable faces.',
  ].join(' ');
}

/** The scene used when the art director could not be reached; still styled, just less personal. */
export function posterPrompt(run: RunSummary, mood?: string, styleId?: string): string {
  const scene = SCENES[run.activityType] ?? 'an athlete in motion';
  const effort = run.effort ?? 5;
  let energy = 'confident, vivid';
  if (effort >= 8) energy = 'explosive, gritty, dramatic';
  else if (effort <= 3) energy = 'calm, airy, serene';
  let distance = 'a quick outing';
  if (run.distanceM >= 10_000) distance = 'an epic long journey';
  else if (run.distanceM >= 5_000) distance = 'a solid effort';
  const place = run.place ? ` in ${run.place}` : ' through a city';
  const parts = [
    `Bold sports poster artwork of ${scene}${place}, ${timeOfDay(run.startedAt)}, celebrating ${distance}.`,
    `Mood: ${mood ? `${mood.slice(0, 80)}, ` : ''}${energy}.`,
    run.elevationGainM && run.elevationGainM > 80 ? 'Rolling hills in the background.' : '',
    run.debrief ? `Inspired by how the athlete felt: ${run.debrief.slice(0, 160)}.` : '',
    styleId && POSTER_STYLES[styleId] ? `Style: ${POSTER_STYLES[styleId].direction}.` : '',
    'Graphic, high-contrast, vertical 9:16 composition with clear empty space at the bottom. No text, no letters, no logos, no numbers.',
  ];
  return parts.filter(Boolean).join(' ');
}

export function toRunSummary(value: unknown): RunSummary | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const distanceM = Number(v.distanceM);
  const durationS = Number(v.durationS);
  const startedAt =
    typeof v.startedAt === 'string' && !Number.isNaN(Date.parse(v.startedAt)) ? v.startedAt : null;
  if (
    !Number.isFinite(distanceM) ||
    distanceM < 0 ||
    !Number.isFinite(durationS) ||
    durationS <= 0 ||
    !startedAt
  ) {
    return null;
  }
  const elevation = Number(v.elevationGainM);
  const effort = Number(v.effort);
  const signal = RUN_SIGNALS.find((x) => x === v.signal);
  const feel = RUN_FEELS.find((x) => x === v.feel);
  const avgHr = num(v.avgHr, 30, 250);
  return {
    activityType: str(v.activityType, 20) || 'run',
    distanceM,
    durationS,
    startedAt,
    ...(Number.isFinite(elevation) && elevation > 0 ? { elevationGainM: elevation } : {}),
    ...(str(v.name, 80) ? { name: str(v.name, 80) } : {}),
    ...(str(v.place, 80) ? { place: str(v.place, 80) } : {}),
    ...(str(v.debrief, 400) ? { debrief: str(v.debrief, 400) } : {}),
    ...(Number.isInteger(effort) && effort >= 1 && effort <= 10 ? { effort } : {}),
    ...(signal ? { signal } : {}),
    ...(feel ? { feel } : {}),
    ...(avgHr === undefined ? {} : { avgHr: Math.round(avgHr) }),
  };
}

export type CoachFeature = 'plan' | 'poster' | 'debrief' | 'review';

const DEFAULT_DAILY: Record<CoachFeature, number> = { plan: 5, poster: 3, debrief: 6, review: 8 };

/** Per-wallet daily allowance, so one athlete can't spend the whole credit balance. */
export class CoachBudget {
  private used = new Map<string, number>();

  constructor(private readonly limits: Record<CoachFeature, number> = DEFAULT_DAILY) {}

  static fromEnv(): CoachBudget {
    const read = (key: string, fallback: number) => {
      const n = Number(process.env[key]);
      return Number.isInteger(n) && n >= 0 ? n : fallback;
    };
    return new CoachBudget({
      plan: read('ZEROG_DAILY_PLANS', DEFAULT_DAILY.plan),
      poster: read('ZEROG_DAILY_POSTERS', DEFAULT_DAILY.poster),
      debrief: read('ZEROG_DAILY_DEBRIEFS', DEFAULT_DAILY.debrief),
      review: read('ZEROG_DAILY_REVIEWS', DEFAULT_DAILY.review),
    });
  }

  private key(wallet: string, feature: CoachFeature, now: Date) {
    return `${now.toISOString().slice(0, 10)}:${feature}:${wallet.toLowerCase()}`;
  }

  /** Takes one use; false once today's allowance is gone. */
  take(wallet: string, feature: CoachFeature, now = new Date()): boolean {
    const key = this.key(wallet, feature, now);
    const count = this.used.get(key) ?? 0;
    if (count >= this.limits[feature]) return false;
    if (this.used.size > 20_000) this.used.clear();
    this.used.set(key, count + 1);
    return true;
  }

  /** Gives back a use whose 0G call failed, so a failure doesn't cost the athlete. */
  refund(wallet: string, feature: CoachFeature, now = new Date()): void {
    const key = this.key(wallet, feature, now);
    const count = this.used.get(key) ?? 0;
    if (count > 0) this.used.set(key, count - 1);
  }

  remaining(wallet: string, feature: CoachFeature, now = new Date()): number {
    return Math.max(0, this.limits[feature] - (this.used.get(this.key(wallet, feature, now)) ?? 0));
  }
}
